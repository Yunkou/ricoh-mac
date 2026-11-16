//! Ratings and flags for imported photographs.
//!
//! Marks are written to an XMP sidecar next to the photograph and mirrored
//! into a SQLite index under the application data directory. Original JPEG
//! and DNG files are only read.

mod index;
mod sidecar;

use std::collections::HashMap;
use std::path::Path;

use crate::error::AppError;

pub use index::CullIndex;
pub use sidecar::{read_marks, sidecar_for_copy, write_marks};

/// A 0-to-5 star rating. Zero means unrated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Rating(u8);

impl Rating {
    pub fn new(value: u8) -> Result<Self, AppError> {
        if value > 5 {
            return Err(AppError::msg("星级必须是 0 到 5。"));
        }
        Ok(Self(value))
    }

    pub fn value(self) -> u8 {
        self.0
    }
}

/// A cull flag. Picked and rejected cannot both be set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Flag {
    #[default]
    None,
    Picked,
    Rejected,
}

impl Flag {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Picked => "picked",
            Self::Rejected => "rejected",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "none" | "" => Ok(Self::None),
            "picked" => Ok(Self::Picked),
            "rejected" => Ok(Self::Rejected),
            _ => Err(AppError::msg("标记必须是已选、排除或无标记。")),
        }
    }
}

/// Stars and a single flag for one photograph.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Marks {
    pub rating: Rating,
    pub flag: Flag,
}

impl Marks {
    pub fn new(rating: u8, flag: Flag) -> Result<Self, AppError> {
        Ok(Self {
            rating: Rating::new(rating)?,
            flag,
        })
    }
}

/// Load marks for every listed file name in `library`.
///
/// A present sidecar is the source of truth. When a sidecar is missing, a
/// previously stored index row may be used. The index is then updated to
/// match. Original photographs are not written. A corrupt sidecar does not
/// use the index and is reported in `errors`.
pub fn load_library_marks(
    library: &Path,
    data_dir: &Path,
    files: &[String],
) -> (HashMap<String, Marks>, Vec<String>, Option<String>) {
    let names: Vec<String> = files.to_vec();
    let index = match CullIndex::open(data_dir) {
        Ok(index) => Some(index),
        Err(err) => {
            return load_from_sidecars_only(library, &names, Some(err.to_string()));
        }
    };
    let Some(index) = index else {
        return load_from_sidecars_only(library, &names, None);
    };
    let mut marks = HashMap::new();
    let mut errors = Vec::new();
    let mut index_error = None;
    for file in &names {
        let path = library.join(file);
        match read_marks(&path, &names) {
            Ok(Some(value)) => {
                if let Err(err) = index.upsert(library, file, value) {
                    index_error = Some(err.to_string());
                }
                marks.insert(file.clone(), value);
            }
            Ok(None) => {
                let stored = index.get(library, file).ok().flatten().unwrap_or_default();
                marks.insert(file.clone(), stored);
            }
            Err(err) => {
                errors.push(format!("{file}：{err}"));
                marks.insert(file.clone(), Marks::default());
            }
        }
    }
    (marks, errors, index_error)
}

fn load_from_sidecars_only(
    library: &Path,
    names: &[String],
    index_error: Option<String>,
) -> (HashMap<String, Marks>, Vec<String>, Option<String>) {
    let mut marks = HashMap::new();
    let mut errors = Vec::new();
    for file in names {
        let path = library.join(file);
        match read_marks(&path, names) {
            Ok(Some(value)) => {
                marks.insert(file.clone(), value);
            }
            Ok(None) => {
                marks.insert(file.clone(), Marks::default());
            }
            Err(err) => {
                errors.push(format!("{file}：{err}"));
                marks.insert(file.clone(), Marks::default());
            }
        }
    }
    (marks, errors, index_error)
}

/// Write marks to the canonical sidecar and then to the index.
///
/// The original photograph is not written. If the sidecar write fails, the
/// index is left unchanged and the error is returned. If the sidecar write
/// succeeds and the index fails, the sidecar remains and the error is
/// returned, so a later load can rebuild the index.
pub fn set_library_marks(
    library: &Path,
    data_dir: &Path,
    photo: &Path,
    marks: Marks,
) -> Result<Marks, AppError> {
    if !crate::metadata::is_inside_library(library, photo) {
        return Err(AppError::msg("找不到这张照片。"));
    }
    let file = photo
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    write_marks(photo, marks)?;
    CullIndex::open(data_dir)?.upsert(library, file, marks)?;
    Ok(marks)
}

#[cfg(test)]
mod tests {
    use super::{Flag, Marks, load_library_marks, set_library_marks};
    use crate::cull::sidecar::{canonical_sidecar_path, write_marks};
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
            "ricoh-mac-cull-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn marks_reject_an_invalid_rating() {
        assert!(Marks::new(6, Flag::None).is_err());
        assert!(Marks::new(5, Flag::Picked).is_ok());
    }

    #[test]
    fn set_and_reload_round_trips_through_sidecar_and_index() {
        let library = unique_dir("round-trip");
        let data = unique_dir("data");
        let photo = library.join("R0000001.JPG");
        fs::write(&photo, b"jpeg-bytes").unwrap();
        let before = fs::read(&photo).unwrap();
        let marks = Marks::new(4, Flag::Picked).unwrap();
        set_library_marks(&library, &data, &photo, marks).unwrap();
        assert_eq!(fs::read(&photo).unwrap(), before);
        let (loaded, errors, index_error) =
            load_library_marks(&library, &data, &["R0000001.JPG".into()]);
        assert!(errors.is_empty(), "{errors:?}");
        assert!(index_error.is_none(), "{index_error:?}");
        assert_eq!(loaded.get("R0000001.JPG"), Some(&marks));
        let sidecar = canonical_sidecar_path(&photo).unwrap();
        fs::remove_file(&sidecar).unwrap();
        let (from_index, errors, _) = load_library_marks(&library, &data, &["R0000001.JPG".into()]);
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(from_index.get("R0000001.JPG"), Some(&marks));
        assert_eq!(fs::read(&photo).unwrap(), before);
    }

    #[test]
    fn a_failed_sidecar_write_does_not_update_the_index() {
        let library = unique_dir("write-fail");
        let data = unique_dir("data-fail");
        let photo = library.join("R0000001.JPG");
        fs::write(&photo, b"jpeg-bytes").unwrap();
        let sidecar = canonical_sidecar_path(&photo).unwrap();
        fs::create_dir_all(&sidecar).unwrap();
        let err = set_library_marks(&library, &data, &photo, Marks::new(3, Flag::None).unwrap())
            .unwrap_err()
            .to_string();
        assert!(err.contains("无法"), "{err}");
        let (loaded, _, _) = load_library_marks(&library, &data, &["R0000001.JPG".into()]);
        assert_eq!(loaded.get("R0000001.JPG"), Some(&Marks::default()));
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg-bytes");
    }

    #[test]
    fn set_marks_rejects_a_path_outside_the_library() {
        let library = unique_dir("inside");
        let outside = unique_dir("outside");
        let data = unique_dir("data-out");
        let photo = outside.join("R0000001.JPG");
        fs::write(&photo, b"jpeg-bytes").unwrap();
        let err = set_library_marks(&library, &data, &photo, Marks::new(1, Flag::None).unwrap())
            .unwrap_err()
            .to_string();
        assert!(err.contains("找不到这张照片"), "{err}");
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg-bytes");
        assert!(
            fs::read_dir(&outside)
                .unwrap()
                .all(|entry| entry.unwrap().file_name() != "R0000001.JPG.xmp")
        );
    }

    #[test]
    fn a_corrupt_sidecar_is_reported_and_does_not_use_the_index() {
        let library = unique_dir("corrupt-load");
        let data = unique_dir("data-corrupt");
        let photo = library.join("R0000001.JPG");
        fs::write(&photo, b"jpeg-bytes").unwrap();
        write_marks(&photo, Marks::new(5, Flag::Rejected).unwrap()).unwrap();
        set_library_marks(
            &library,
            &data,
            &photo,
            Marks::new(5, Flag::Rejected).unwrap(),
        )
        .unwrap();
        let sidecar = canonical_sidecar_path(&photo).unwrap();
        fs::write(&sidecar, b"<not-xml").unwrap();
        let (loaded, errors, _) = load_library_marks(&library, &data, &["R0000001.JPG".into()]);
        assert_eq!(loaded.get("R0000001.JPG"), Some(&Marks::default()));
        assert_eq!(errors.len(), 1, "{errors:?}");
        assert!(errors[0].contains("R0000001.JPG"));
        assert_eq!(fs::read(&sidecar).unwrap(), b"<not-xml");
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg-bytes");
    }
}
