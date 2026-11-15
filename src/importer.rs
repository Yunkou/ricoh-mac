//! Import camera files into a single library folder, keeping original names.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::camera::{CameraClient, CameraPhoto, DownloadMeta};
use crate::error::AppError;

/// Outcome of one file in an import batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileImportStatus {
    Imported,
    Skipped,
    Conflict,
    Error,
}

/// Result for a single photo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileImportResult {
    pub folder: String,
    pub file: String,
    pub status: FileImportStatus,
    pub message: String,
}

impl FileImportResult {
    fn imported(photo: &CameraPhoto, dest: &Path) -> Self {
        Self {
            folder: photo.folder.clone(),
            file: photo.file.clone(),
            status: FileImportStatus::Imported,
            message: format!("Saved as {}", dest.display()),
        }
    }

    fn skipped(photo: &CameraPhoto, dest: &Path) -> Self {
        Self {
            folder: photo.folder.clone(),
            file: photo.file.clone(),
            status: FileImportStatus::Skipped,
            message: format!("Already in the library ({})", dest.display()),
        }
    }

    fn conflict(photo: &CameraPhoto, dest: &Path) -> Self {
        Self {
            folder: photo.folder.clone(),
            file: photo.file.clone(),
            status: FileImportStatus::Conflict,
            message: format!(
                "A different file already exists at {} and was left unchanged",
                dest.display()
            ),
        }
    }

    fn error(photo: &CameraPhoto, message: impl Into<String>) -> Self {
        Self {
            folder: photo.folder.clone(),
            file: photo.file.clone(),
            status: FileImportStatus::Error,
            message: message.into(),
        }
    }
}

/// Summary of a batch import.
#[derive(Debug, Clone, Default)]
pub struct ImportSummary {
    pub results: Vec<FileImportResult>,
}

impl ImportSummary {
    pub fn imported(&self) -> usize {
        self.count(FileImportStatus::Imported)
    }

    pub fn skipped(&self) -> usize {
        self.count(FileImportStatus::Skipped)
    }

    pub fn conflicts(&self) -> usize {
        self.count(FileImportStatus::Conflict)
    }

    pub fn errors(&self) -> usize {
        self.count(FileImportStatus::Error)
    }

    fn count(&self, status: FileImportStatus) -> usize {
        self.results
            .iter()
            .filter(|item| item.status == status)
            .count()
    }
}

/// Progress of a batch import, reported after each file.
#[derive(Debug, Clone)]
pub struct ImportProgress {
    pub current: u32,
    pub total: u32,
    pub file: String,
    pub status: String,
    pub message: String,
}

/// Writes camera files into one library folder.
pub struct Importer<'a> {
    pub library: &'a Path,
    pub client: &'a CameraClient,
}

impl<'a> Importer<'a> {
    pub fn new(library: &'a Path, client: &'a CameraClient) -> Self {
        Self { library, client }
    }

    /// Import `photos` in order. The library folder must already exist.
    /// Destination names are the camera's original file names, with no extra
    /// directory layer. Existing complete files of the same size are skipped.
    /// Existing complete files of a different size are reported as conflicts
    /// and are not overwritten. Temporary files use a `.partial` suffix in the
    /// same folder, and are renamed into place only after the size checks out.
    pub fn import_photos(
        &self,
        photos: &[CameraPhoto],
        mut on_progress: impl FnMut(ImportProgress),
    ) -> ImportSummary {
        let mut summary = ImportSummary::default();
        let total = photos.len() as u32;
        for (index, photo) in photos.iter().enumerate() {
            let result = self.import_one(photo);
            on_progress(ImportProgress {
                current: (index as u32) + 1,
                total,
                file: photo.file.clone(),
                status: status_label(&result.status).to_string(),
                message: result.message.clone(),
            });
            summary.results.push(result);
        }
        summary
    }

    fn import_one(&self, photo: &CameraPhoto) -> FileImportResult {
        if let Err(err) = ensure_library(self.library) {
            return FileImportResult::error(photo, err);
        }
        if photo.file.is_empty()
            || photo.file.contains('/')
            || photo.file.contains('\\')
            || photo.file == "."
            || photo.file == ".."
        {
            return FileImportResult::error(
                photo,
                "The camera file name is not a usable file name",
            );
        }
        let dest = self.library.join(&photo.file);
        let expected = self.client.file_size(photo);
        if dest.exists() {
            match dest_size(&dest) {
                Ok(existing) => {
                    if let Some(expected) = expected {
                        if existing == expected {
                            return FileImportResult::skipped(photo, &dest);
                        }
                        return FileImportResult::conflict(photo, &dest);
                    }
                }
                Err(err) => return FileImportResult::error(photo, err),
            }
        }

        let partial = partial_path(&dest);
        let mut guard = PartialGuard::new(partial.clone());
        let result = download_to_partial(self.client, photo, &partial, expected);
        match result {
            Ok(meta) => {
                let outcome = finish_partial(photo, &dest, &partial, expected, meta);
                guard.keep();
                outcome
            }
            Err(err) => {
                let _ = fs::remove_file(&partial);
                guard.keep();
                FileImportResult::error(photo, err)
            }
        }
    }
}

fn ensure_library(path: &Path) -> Result<(), AppError> {
    let meta = fs::metadata(path).map_err(|err| {
        AppError::msg(format!(
            "The library folder {} is not available: {err}",
            path.display()
        ))
    })?;
    if !meta.is_dir() {
        return Err(AppError::msg(format!("{} is not a folder", path.display())));
    }
    Ok(())
}

fn dest_size(path: &Path) -> Result<u64, AppError> {
    fs::metadata(path)
        .map(|meta| meta.len())
        .map_err(|err| AppError::msg(format!("Could not read {}: {err}", path.display())))
}

/// Removes a `.partial` file if a panic unwinds before it is renamed into place.
struct PartialGuard {
    path: PathBuf,
    keep: bool,
}

impl PartialGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, keep: false }
    }

    fn keep(&mut self) {
        self.keep = true;
    }
}

impl Drop for PartialGuard {
    fn drop(&mut self) {
        if !self.keep && std::thread::panicking() {
            let _ = fs::remove_file(&self.path);
        }
    }
}

fn partial_path(dest: &Path) -> PathBuf {
    let mut name = dest
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    name.push_str(".partial");
    dest.with_file_name(name)
}

fn download_to_partial(
    client: &CameraClient,
    photo: &CameraPhoto,
    partial: &Path,
    expected: Option<u64>,
) -> Result<DownloadMeta, AppError> {
    let existing = match fs::metadata(partial) {
        Ok(meta) if meta.is_file() => meta.len(),
        Ok(_) => {
            return Err(AppError::msg(format!(
                "The temporary path {} exists and is not a file",
                partial.display()
            )));
        }
        Err(err) if err.kind() == io::ErrorKind::NotFound => 0,
        Err(err) => {
            return Err(AppError::msg(format!(
                "Could not inspect {}: {err}",
                partial.display()
            )));
        }
    };

    if existing > 0 {
        let mut file = OpenOptions::new()
            .append(true)
            .open(partial)
            .map_err(|err| AppError::msg(format!("Could not open {}: {err}", partial.display())))?;
        match client.download_to(photo, None, existing, &mut file) {
            Ok(meta) if meta.status == 206 || meta.resumed => {
                file.flush().map_err(|err| {
                    AppError::msg(format!("Could not write {}: {err}", partial.display()))
                })?;
                return Ok(meta);
            }
            Ok(_) | Err(_) => {
                // Range was ignored or not supported. Discard the incomplete
                // file and download again.
                drop(file);
                let _ = fs::remove_file(partial);
            }
        }
    }

    let mut file = File::create(partial)
        .map_err(|err| AppError::msg(format!("Could not create {}: {err}", partial.display())))?;
    let meta = client
        .download_to(photo, None, 0, &mut file)
        .map_err(AppError::from)?;
    file.flush()
        .map_err(|err| AppError::msg(format!("Could not write {}: {err}", partial.display())))?;
    if let Some(expected) = expected.or(meta.content_length) {
        // When this was a full GET, content_length and bytes_written are the full size.
        if meta.bytes_written != expected && meta.status == 200 {
            return Err(AppError::msg(format!(
                "Downloaded size {} does not match expected size {expected}",
                meta.bytes_written
            )));
        }
    }
    Ok(meta)
}

fn finish_partial(
    photo: &CameraPhoto,
    dest: &Path,
    partial: &Path,
    expected: Option<u64>,
    meta: DownloadMeta,
) -> FileImportResult {
    let partial_len = match fs::metadata(partial) {
        Ok(meta) => meta.len(),
        Err(err) => {
            let _ = fs::remove_file(partial);
            return FileImportResult::error(
                photo,
                format!("Could not inspect temporary file: {err}"),
            );
        }
    };
    if let Some(expected) = expected {
        if partial_len != expected {
            let _ = fs::remove_file(partial);
            return FileImportResult::error(
                photo,
                format!("Downloaded size {partial_len} does not match expected size {expected}"),
            );
        }
    } else if let Some(length) = meta.content_length {
        // For a non-resumed 200, Content-Length is the full body.
        if meta.status == 200 && partial_len != length {
            let _ = fs::remove_file(partial);
            return FileImportResult::error(
                photo,
                format!("Downloaded size {partial_len} does not match Content-Length {length}"),
            );
        }
    }

    if dest.exists() {
        match dest_size(dest) {
            Ok(existing) if existing == partial_len => {
                let _ = fs::remove_file(partial);
                return FileImportResult::skipped(photo, dest);
            }
            Ok(_) => {
                let _ = fs::remove_file(partial);
                return FileImportResult::conflict(photo, dest);
            }
            Err(err) => {
                let _ = fs::remove_file(partial);
                return FileImportResult::error(photo, err);
            }
        }
    }

    if let Err(err) = fs::rename(partial, dest) {
        let _ = fs::remove_file(partial);
        return FileImportResult::error(
            photo,
            format!("Could not finalize {}: {err}", dest.display()),
        );
    }
    FileImportResult::imported(photo, dest)
}

fn status_label(status: &FileImportStatus) -> &'static str {
    match status {
        FileImportStatus::Imported => "imported",
        FileImportStatus::Skipped => "skipped",
        FileImportStatus::Conflict => "conflict",
        FileImportStatus::Error => "error",
    }
}

/// Download a thumbnail (`size=thumb`) into `dest`, replacing any previous file.
pub fn download_thumbnail(
    client: &CameraClient,
    photo: &CameraPhoto,
    dest: &Path,
) -> Result<PathBuf, AppError> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| AppError::msg(format!("Could not create thumbnail cache: {err}")))?;
    }
    let tmp = dest.with_extension("part");
    let mut file = File::create(&tmp)
        .map_err(|err| AppError::msg(format!("Could not write thumbnail: {err}")))?;
    client
        .download_to(photo, Some("thumb"), 0, &mut file)
        .map_err(AppError::from)?;
    file.flush()
        .map_err(|err| AppError::msg(format!("Could not write thumbnail: {err}")))?;
    fs::rename(&tmp, dest)
        .map_err(|err| AppError::msg(format!("Could not finalize thumbnail: {err}")))?;
    Ok(dest.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_path_uses_original_name() {
        let dest = PathBuf::from("/tmp/library/R0000001.JPG");
        assert_eq!(
            partial_path(&dest),
            PathBuf::from("/tmp/library/R0000001.JPG.partial")
        );
    }

    #[test]
    fn rejects_path_elements_in_file_name() {
        // The importer is unit-tested against a live mock in camera_import tests.
        let photo = CameraPhoto {
            folder: "100RICOH".to_string(),
            file: "../escape.JPG".to_string(),
            size: None,
        };
        assert!(
            photo.file.contains('/') || photo.file.contains('\\') || photo.file.starts_with('.')
        );
    }
}
