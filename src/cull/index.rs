//! A rebuildable SQLite index of ratings and flags.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, OptionalExtension, params};

use super::{Flag, Marks};
use crate::error::AppError;

const DB_NAME: &str = "cull-index.sqlite";

pub struct CullIndex {
    conn: Connection,
}

impl CullIndex {
    pub fn open(data_dir: &Path) -> Result<Self, AppError> {
        std::fs::create_dir_all(data_dir).map_err(|err| AppError::io("无法更新选片索引", err))?;
        let path = data_dir.join(DB_NAME);
        let conn = Connection::open(&path)
            .map_err(|err| AppError::msg(format!("无法打开选片索引：{err}")))?;
        conn.busy_timeout(std::time::Duration::from_secs(3))
            .map_err(|err| AppError::msg(format!("无法打开选片索引：{err}")))?;
        conn.execute_batch(
            "
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS marks (
                library TEXT NOT NULL,
                file TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 5),
                flag TEXT NOT NULL CHECK (flag IN ('none', 'picked', 'rejected')),
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (library, file)
            );
            ",
        )
        .map_err(|err| AppError::msg(format!("无法打开选片索引：{err}")))?;
        Ok(Self { conn })
    }

    fn library_key(library: &Path) -> Result<String, AppError> {
        let canonical = library
            .canonicalize()
            .map_err(|err| AppError::io("无法打开保存位置", err))?;
        Ok(canonical.display().to_string())
    }

    pub fn upsert(&self, library: &Path, file: &str, marks: Marks) -> Result<(), AppError> {
        let library = Self::library_key(library)?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_secs() as i64)
            .unwrap_or(0);
        self.conn
            .execute(
                "INSERT INTO marks (library, file, rating, flag, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(library, file) DO UPDATE SET
                    rating = excluded.rating,
                    flag = excluded.flag,
                    updated_at = excluded.updated_at",
                params![
                    library,
                    file,
                    marks.rating.value() as i64,
                    marks.flag.as_str(),
                    now
                ],
            )
            .map_err(|err| AppError::msg(format!("无法更新选片索引：{err}")))?;
        Ok(())
    }

    pub fn get(&self, library: &Path, file: &str) -> Result<Option<Marks>, AppError> {
        let library = Self::library_key(library)?;
        let row = self
            .conn
            .query_row(
                "SELECT rating, flag FROM marks WHERE library = ?1 AND file = ?2",
                params![library, file],
                |row| {
                    let rating: i64 = row.get(0)?;
                    let flag: String = row.get(1)?;
                    Ok((rating, flag))
                },
            )
            .optional()
            .map_err(|err| AppError::msg(format!("无法读取选片索引：{err}")))?;
        row.map(|(rating, flag)| {
            if !(0..=5).contains(&rating) {
                return Err(AppError::msg("选片索引中的星级无效。"));
            }
            Marks::new(rating as u8, Flag::parse(&flag)?)
        })
        .transpose()
    }
}

#[cfg(test)]
mod tests {
    use super::CullIndex;
    use crate::cull::{Flag, Marks};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir(label: &str) -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-cull-index-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn upsert_and_get_round_trip_and_stay_per_library() {
        let data = unique_dir("idx");
        let lib_a = unique_dir("lib-a");
        let lib_b = unique_dir("lib-b");
        let index = CullIndex::open(&data).unwrap();
        index
            .upsert(&lib_a, "R0000001.JPG", Marks::new(2, Flag::Picked).unwrap())
            .unwrap();
        index
            .upsert(
                &lib_b,
                "R0000001.JPG",
                Marks::new(5, Flag::Rejected).unwrap(),
            )
            .unwrap();
        assert_eq!(
            index.get(&lib_a, "R0000001.JPG").unwrap(),
            Some(Marks::new(2, Flag::Picked).unwrap())
        );
        assert_eq!(
            index.get(&lib_b, "R0000001.JPG").unwrap(),
            Some(Marks::new(5, Flag::Rejected).unwrap())
        );
        assert_eq!(index.get(&lib_a, "missing.JPG").unwrap(), None);
    }
}
