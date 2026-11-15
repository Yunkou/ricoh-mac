//! Read-only listing of photos already imported into the library folder.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// A photo file that sits directly in the library folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedPhoto {
    /// Original file name, unique within the single import folder.
    pub file: String,
    /// Size in bytes, when the metadata can be read.
    pub size: Option<u64>,
    /// Absolute path of the file on disk.
    pub path: PathBuf,
    /// Whether the file's container is a raster format the image view can display.
    pub previewable: bool,
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn is_listed(ext: &str) -> bool {
    matches!(
        ext,
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "tif" | "tiff" | "heic" | "heif" | "bmp" | "dng"
    )
}

fn is_previewable(ext: &str) -> bool {
    matches!(
        ext,
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "tif" | "tiff" | "heic" | "heif" | "bmp"
    )
}

fn is_skipped_name(name: &str) -> bool {
    name.starts_with('.') || name.ends_with(".partial")
}

/// List photograph files that sit directly in `folder`.
///
/// The function reads directory metadata only. It does not create, rewrite,
/// move, or delete files, and it does not descend into subfolders.
pub fn list_imported_photos(folder: &Path) -> Result<Vec<ImportedPhoto>, AppError> {
    if !folder.is_dir() {
        return Err(AppError::msg("找不到保存位置。"));
    }

    let mut photos = Vec::new();
    let entries = fs::read_dir(folder).map_err(|_err| AppError::msg("无法打开保存位置。"))?;
    for entry in entries {
        let entry = entry.map_err(|_err| AppError::msg("无法打开保存位置。"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|_err| AppError::msg("无法读取照片。"))?;
        if !file_type.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if is_skipped_name(name) {
            continue;
        }
        let ext = extension(&path);
        if !is_listed(&ext) {
            continue;
        }
        let size = entry.metadata().ok().map(|meta| meta.len());
        photos.push(ImportedPhoto {
            file: name.to_string(),
            size,
            path,
            previewable: is_previewable(&ext),
        });
    }
    photos.sort_by(|left, right| {
        left.file
            .to_ascii_lowercase()
            .cmp(&right.file.to_ascii_lowercase())
            .then_with(|| left.file.cmp(&right.file))
    });
    Ok(photos)
}

pub fn file_url(path: &Path) -> String {
    format!("file://{}", path.display())
}

#[cfg(test)]
mod tests {
    use super::list_imported_photos;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir() -> std::path::PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-album-{}-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(dir: &std::path::Path, name: &str, bytes: &[u8]) {
        fs::write(dir.join(name), bytes).unwrap();
    }

    fn snapshot(dir: &std::path::Path) -> Vec<(String, u64, Vec<u8>)> {
        let mut items = Vec::new();
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                for nested in fs::read_dir(&path).unwrap() {
                    let nested = nested.unwrap();
                    let nested_path = nested.path();
                    let rel = format!(
                        "{}/{}",
                        path.file_name().unwrap().to_string_lossy(),
                        nested.file_name().to_string_lossy()
                    );
                    items.push((
                        rel,
                        nested.metadata().unwrap().len(),
                        fs::read(&nested_path).unwrap(),
                    ));
                }
                continue;
            }
            items.push((
                entry.file_name().to_string_lossy().into_owned(),
                entry.metadata().unwrap().len(),
                fs::read(&path).unwrap(),
            ));
        }
        items.sort_by(|left, right| left.0.cmp(&right.0));
        items
    }

    #[test]
    fn lists_direct_photos_and_skips_partials_hidden_and_other_files() {
        let dir = unique_dir();
        write(&dir, "R0000002.DNG", b"dng-bytes");
        write(&dir, "R0000001.JPG", b"jpeg-bytes");
        write(&dir, "R0000001.JPG.partial", b"partial");
        write(&dir, ".hidden.jpg", b"hidden");
        write(&dir, "notes.txt", b"text");
        let nested = dir.join("sub");
        fs::create_dir_all(&nested).unwrap();
        write(&nested, "nested.JPG", b"nested");

        let listed = list_imported_photos(&dir).unwrap();
        let names: Vec<_> = listed.iter().map(|photo| photo.file.as_str()).collect();
        assert_eq!(names, ["R0000001.JPG", "R0000002.DNG"]);
        assert!(listed[0].previewable);
        assert!(!listed[1].previewable);
        assert_eq!(listed[0].size, Some(10));
        assert_eq!(listed[0].path, dir.join("R0000001.JPG"));
    }

    #[test]
    fn listing_does_not_modify_files_in_the_folder() {
        let dir = unique_dir();
        write(&dir, "R0000001.JPG", b"original-jpeg");
        write(&dir, "R0000002.DNG", b"original-dng");
        write(&dir, "keep.txt", b"leave-me");
        let before = snapshot(&dir);
        let _listed = list_imported_photos(&dir).unwrap();
        assert_eq!(snapshot(&dir), before);
    }

    #[test]
    fn empty_folder_returns_no_photos() {
        let dir = unique_dir();
        assert!(list_imported_photos(&dir).unwrap().is_empty());
    }

    #[test]
    fn missing_folder_is_an_error() {
        let dir = unique_dir().join("missing");
        let err = list_imported_photos(&dir).unwrap_err().to_string();
        assert!(err.contains("找不到保存位置"), "{err}");
    }
}
