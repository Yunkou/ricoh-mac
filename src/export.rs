//! Copy picked library photographs and their existing XMP sidecars
//! into a user-chosen folder, without changing the originals.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::album::{ImportedPhoto, list_imported_photos};
use crate::cull::{Flag, Marks, read_marks, sidecar_for_copy};
use crate::error::AppError;
use crate::metadata::is_inside_library;

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// One photograph in an export batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportItem {
    pub file: String,
    pub status: ExportItemStatus,
    pub message: String,
    pub original_copied: bool,
    pub sidecar_copied: bool,
}

/// Outcome for one photograph. The original and its sidecar count as one result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportItemStatus {
    /// The original was copied, and the sidecar was copied when one was present.
    Exported,
    /// The original was copied, but a sidecar that should have been copied was not.
    Partial,
    /// The original was not copied.
    Error,
}

impl ExportItemStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exported => "exported",
            Self::Partial => "partial",
            Self::Error => "error",
        }
    }
}

/// Batch result of exporting picked photographs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportReport {
    pub exported: usize,
    pub failed: usize,
    pub destination: PathBuf,
    pub items: Vec<ExportItem>,
}

/// Progress for one photograph in a batch.
#[cfg(test)]
#[derive(Debug, Clone)]
pub struct ExportProgress {
    pub current: usize,
    pub total: usize,
    pub file: String,
}

/// Validate the destination, collect every picked photograph in the album,
/// and copy each one into `destination`.
///
/// Picked photographs are taken from the whole album, not from a filtered
/// view. Originals and existing sidecars are copied as bytes. They are never
/// moved, rewritten, or deleted. A name that already exists in the
/// destination is left unchanged.
#[cfg(test)]
pub fn export_picked_photos(
    library: &Path,
    destination: &Path,
    data_dir: Option<&Path>,
    mut on_progress: impl FnMut(ExportProgress),
) -> Result<ExportReport, AppError> {
    let prepared = prepare_export(library, destination, data_dir)?;
    let total = prepared.photos.len();
    let mut items = Vec::with_capacity(total);
    for (index, photo) in prepared.photos.iter().enumerate() {
        on_progress(ExportProgress {
            current: index + 1,
            total,
            file: photo.file.clone(),
        });
        items.push(export_one(
            library,
            &prepared.destination,
            photo,
            &prepared.siblings,
        ));
    }
    Ok(summarize_export(prepared.destination, items))
}

/// Destination and the picked photographs that will be copied into it.
pub struct PreparedExport {
    pub destination: PathBuf,
    pub photos: Vec<ImportedPhoto>,
    pub siblings: Vec<String>,
}

/// Validate the destination and collect every picked photograph in the album.
pub fn prepare_picked_photos(
    library: &Path,
    destination: &Path,
    data_dir: Option<&Path>,
) -> Result<PreparedExport, AppError> {
    prepare_export(library, destination, data_dir)
}

/// Copy one photograph and its sidecar, if any, into `destination`.
pub fn export_one_photo(
    library: &Path,
    destination: &Path,
    photo: &ImportedPhoto,
    siblings: &[String],
) -> ExportItem {
    export_one(library, destination, photo, siblings)
}

fn prepare_export(
    library: &Path,
    destination: &Path,
    data_dir: Option<&Path>,
) -> Result<PreparedExport, AppError> {
    let library_root = library
        .canonicalize()
        .map_err(|err| AppError::io("无法打开保存位置", err))?;
    if !library_root.is_dir() {
        return Err(AppError::msg("找不到保存位置。"));
    }
    let dest_root = canonicalize_dir(destination)?;
    if dest_root == library_root {
        return Err(AppError::msg(
            "不能导出到当前保存位置。请选择另一个文件夹。",
        ));
    }

    let listed = list_imported_photos(&library_root)?;
    let siblings: Vec<String> = listed.iter().map(|photo| photo.file.clone()).collect();
    let marks = load_marks(&library_root, data_dir, &siblings);
    let photos: Vec<ImportedPhoto> = listed
        .into_iter()
        .filter(|photo| marks.get(&photo.file).is_some_and(is_picked))
        .collect();
    if photos.is_empty() {
        return Err(AppError::msg("没有已选照片。"));
    }
    Ok(PreparedExport {
        destination: dest_root,
        photos,
        siblings,
    })
}

fn canonicalize_dir(path: &Path) -> Result<PathBuf, AppError> {
    let canonical = path
        .canonicalize()
        .map_err(|err| AppError::io("无法打开导出文件夹", err))?;
    if !canonical.is_dir() {
        return Err(AppError::msg("请选择一个文件夹。"));
    }
    Ok(canonical)
}

fn load_marks(
    library: &Path,
    data_dir: Option<&Path>,
    files: &[String],
) -> std::collections::HashMap<String, Marks> {
    match data_dir {
        Some(dir) => crate::cull::load_library_marks(library, dir, files).0,
        None => sidecar_marks_only(library, files),
    }
}

fn sidecar_marks_only(
    library: &Path,
    files: &[String],
) -> std::collections::HashMap<String, Marks> {
    let mut marks = std::collections::HashMap::new();
    for file in files {
        let path = library.join(file);
        let value = read_marks(&path, files).ok().flatten().unwrap_or_default();
        marks.insert(file.clone(), value);
    }
    marks
}

fn is_picked(marks: &Marks) -> bool {
    marks.flag == Flag::Picked
}

fn export_one(
    library: &Path,
    destination: &Path,
    photo: &ImportedPhoto,
    siblings: &[String],
) -> ExportItem {
    match try_export_one(library, destination, photo, siblings) {
        Ok(item) => item,
        Err(err) => ExportItem {
            file: photo.file.clone(),
            status: ExportItemStatus::Error,
            message: err.to_string(),
            original_copied: false,
            sidecar_copied: false,
        },
    }
}

fn try_export_one(
    library: &Path,
    destination: &Path,
    photo: &ImportedPhoto,
    siblings: &[String],
) -> Result<ExportItem, AppError> {
    if !is_inside_library(library, &photo.path) {
        return Err(AppError::msg("找不到这张照片。"));
    }
    let file_name = safe_file_name(&photo.path)?;
    let dest_original = destination.join(file_name);
    if !is_inside_dir(destination, &dest_original) {
        return Err(AppError::msg("无法写入导出文件夹。"));
    }
    if !photo.path.is_file() {
        return Err(AppError::msg("找不到原片。"));
    }

    if let Err(err) = copy_file_exclusive(&photo.path, &dest_original) {
        return Ok(ExportItem {
            file: photo.file.clone(),
            status: ExportItemStatus::Error,
            message: copy_error_message("原片", file_name, err),
            original_copied: false,
            sidecar_copied: false,
        });
    }

    let sidecar_source = match sidecar_for_copy(&photo.path, siblings) {
        Ok(path) => path,
        Err(err) => {
            return Ok(ExportItem {
                file: photo.file.clone(),
                status: ExportItemStatus::Partial,
                message: format!("原片已复制，但无法确定标记文件：{err}"),
                original_copied: true,
                sidecar_copied: false,
            });
        }
    };

    let Some(sidecar_source) = sidecar_source else {
        return Ok(ExportItem {
            file: photo.file.clone(),
            status: ExportItemStatus::Exported,
            message: "已复制原片。".to_string(),
            original_copied: true,
            sidecar_copied: false,
        });
    };

    let sidecar_name = match safe_file_name(&sidecar_source) {
        Ok(name) => name,
        Err(err) => {
            return Ok(ExportItem {
                file: photo.file.clone(),
                status: ExportItemStatus::Partial,
                message: format!("原片已复制，但标记文件名无效：{err}"),
                original_copied: true,
                sidecar_copied: false,
            });
        }
    };
    let dest_sidecar = destination.join(sidecar_name);
    if !is_inside_dir(destination, &dest_sidecar) {
        return Ok(ExportItem {
            file: photo.file.clone(),
            status: ExportItemStatus::Partial,
            message: "原片已复制，但无法写入标记文件。".to_string(),
            original_copied: true,
            sidecar_copied: false,
        });
    }
    if let Err(err) = copy_file_exclusive(&sidecar_source, &dest_sidecar) {
        return Ok(ExportItem {
            file: photo.file.clone(),
            status: ExportItemStatus::Partial,
            message: format!(
                "原片已复制，{}",
                copy_error_message("标记文件", sidecar_name, err)
            ),
            original_copied: true,
            sidecar_copied: false,
        });
    }
    Ok(ExportItem {
        file: photo.file.clone(),
        status: ExportItemStatus::Exported,
        message: "已复制原片和标记文件。".to_string(),
        original_copied: true,
        sidecar_copied: true,
    })
}

fn copy_error_message(kind: &str, name: &str, err: CopyError) -> String {
    match err {
        CopyError::AlreadyExists => format!("目标中已有同名{kind} {name}，未覆盖。"),
        CopyError::Incomplete => format!("{kind}复制不完整，未留下目标文件。"),
        CopyError::Io(source) => format!("无法复制{kind} {name}：{source}"),
    }
}

/// Count fully exported photographs versus failures.
pub fn summarize_export(destination: PathBuf, items: Vec<ExportItem>) -> ExportReport {
    let exported = items
        .iter()
        .filter(|item| item.status == ExportItemStatus::Exported)
        .count();
    let failed = items.len() - exported;
    ExportReport {
        exported,
        failed,
        destination,
        items,
    }
}

fn safe_file_name(path: &Path) -> Result<&str, AppError> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name == "."
        || name == ".."
        || name.contains('\0')
    {
        return Err(AppError::msg("找不到这张照片。"));
    }
    Ok(name)
}

fn is_inside_dir(dir: &Path, path: &Path) -> bool {
    let Ok(root) = dir.canonicalize() else {
        return false;
    };
    let Some(parent) = path.parent() else {
        return false;
    };
    let Ok(parent) = parent.canonicalize() else {
        return false;
    };
    let Some(name) = path.file_name() else {
        return false;
    };
    parent.join(name).starts_with(&root)
}

#[derive(Debug)]
enum CopyError {
    AlreadyExists,
    Incomplete,
    Io(io::Error),
}

impl From<io::Error> for CopyError {
    fn from(err: io::Error) -> Self {
        if err.kind() == io::ErrorKind::AlreadyExists {
            Self::AlreadyExists
        } else {
            Self::Io(err)
        }
    }
}

/// Copy `src` to `dest` so an existing name is never overwritten or truncated.
///
/// The destination name is reserved with an exclusive `create_new` temporary
/// file in the same folder, then linked into place. A failure removes the
/// temporary file and does not leave a truncated file under the final name.
fn copy_file_exclusive(src: &Path, dest: &Path) -> Result<(), CopyError> {
    if name_exists(dest)? {
        return Err(CopyError::AlreadyExists);
    }
    let tmp = temporary_path(dest)?;
    let mut guard = TempGuard::new(tmp.clone());
    let mut output = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    let mut input = File::open(src)?;
    let expected = input.metadata()?.len();
    let copied = io::copy(&mut input, &mut output)?;
    output.flush()?;
    output.sync_all()?;
    drop(output);
    if copied != expected {
        return Err(CopyError::Incomplete);
    }
    let written = fs::metadata(&tmp)?.len();
    if written != expected {
        return Err(CopyError::Incomplete);
    }
    if name_exists(dest)? {
        return Err(CopyError::AlreadyExists);
    }
    match fs::hard_link(&tmp, dest) {
        Ok(()) => {
            guard.defuse();
            let _ = fs::remove_file(&tmp);
            if fs::metadata(dest).map(|meta| meta.len()).unwrap_or(0) != expected {
                let _ = fs::remove_file(dest);
                return Err(CopyError::Incomplete);
            }
            Ok(())
        }
        Err(err) if err.kind() == io::ErrorKind::AlreadyExists => Err(CopyError::AlreadyExists),
        Err(err) => Err(CopyError::Io(err)),
    }
}

fn name_exists(path: &Path) -> Result<bool, CopyError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(err) => Err(CopyError::Io(err)),
    }
}

fn temporary_path(dest: &Path) -> Result<PathBuf, CopyError> {
    let parent = dest.parent().ok_or_else(|| {
        CopyError::Io(io::Error::new(
            io::ErrorKind::InvalidInput,
            "missing destination folder",
        ))
    })?;
    let name = dest
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            CopyError::Io(io::Error::new(
                io::ErrorKind::InvalidInput,
                "missing destination name",
            ))
        })?;
    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    Ok(parent.join(format!(".{name}.{}.{seq}.partial", std::process::id())))
}

struct TempGuard {
    path: Option<PathBuf>,
}

impl TempGuard {
    fn new(path: PathBuf) -> Self {
        Self { path: Some(path) }
    }

    fn defuse(&mut self) {
        self.path = None;
    }
}

impl Drop for TempGuard {
    fn drop(&mut self) {
        if let Some(path) = self.path.take() {
            let _ = fs::remove_file(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        CopyError, ExportItemStatus, copy_file_exclusive, export_one, export_picked_photos,
        is_inside_dir, name_exists,
    };
    use crate::album::ImportedPhoto;
    use crate::cull::{Flag, Marks};
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir(label: &str) -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-export-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file(path: &Path, bytes: &[u8]) {
        fs::write(path, bytes).unwrap();
    }

    fn fingerprint(path: &Path) -> (u64, Vec<u8>) {
        let bytes = fs::read(path).unwrap();
        (bytes.len() as u64, bytes)
    }

    fn mark_picked(library: &Path, file: &str) {
        let photo = library.join(file);
        crate::cull::write_marks(&photo, Marks::new(0, Flag::Picked).unwrap()).unwrap();
    }

    fn mark_picked_in_index(library: &Path, data_dir: &Path, file: &str) {
        let index = crate::cull::CullIndex::open(data_dir).unwrap();
        index
            .upsert(library, file, Marks::new(0, Flag::Picked).unwrap())
            .unwrap();
    }

    #[test]
    fn export_fails_when_nothing_is_picked() {
        let library = unique_dir("empty");
        let dest = unique_dir("empty-dest");
        write_file(&library.join("R0000001.JPG"), b"jpeg-one");
        let err = export_picked_photos(&library, &dest, None, |_| {}).unwrap_err();
        assert!(err.to_string().contains("没有已选照片"));
        assert!(fs::read_dir(&dest).unwrap().next().is_none());
    }

    #[test]
    fn export_copies_an_original_without_a_sidecar() {
        let library = unique_dir("plain");
        let dest = unique_dir("plain-dest");
        let source = library.join("R0000001.JPG");
        write_file(&source, b"jpeg-bytes");
        let data_dir = unique_dir("plain-data");
        mark_picked_in_index(&library, &data_dir, "R0000001.JPG");
        let before = fingerprint(&source);
        let report = export_picked_photos(&library, &dest, Some(&data_dir), |_| {}).unwrap();
        assert_eq!(report.exported, 1);
        assert_eq!(report.failed, 0);
        assert_eq!(report.items[0].status, ExportItemStatus::Exported);
        assert!(report.items[0].original_copied);
        assert!(!report.items[0].sidecar_copied);
        assert_eq!(fingerprint(&dest.join("R0000001.JPG")), before);
        assert!(!dest.join("R0000001.JPG.xmp").exists());
        assert_eq!(fingerprint(&source), before);
    }

    #[test]
    fn export_copies_an_original_and_its_canonical_sidecar() {
        let library = unique_dir("sidecar");
        let dest = unique_dir("sidecar-dest");
        let source = library.join("R0000001.JPG");
        write_file(&source, b"jpeg-bytes");
        mark_picked(&library, "R0000001.JPG");
        let sidecar = library.join("R0000001.JPG.xmp");
        let photo_before = fingerprint(&source);
        let sidecar_before = fingerprint(&sidecar);
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 1);
        assert_eq!(report.failed, 0);
        assert!(report.items[0].sidecar_copied);
        assert_eq!(fingerprint(&dest.join("R0000001.JPG")), photo_before);
        assert_eq!(fingerprint(&dest.join("R0000001.JPG.xmp")), sidecar_before);
        assert_eq!(fingerprint(&source), photo_before);
        assert_eq!(fingerprint(&sidecar), sidecar_before);
    }

    #[test]
    fn export_copies_a_stem_sidecar_only_when_the_stem_is_not_shared() {
        let library = unique_dir("stem");
        let dest = unique_dir("stem-dest");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        mark_picked(&library, "R0000001.JPG");
        fs::rename(
            library.join("R0000001.JPG.xmp"),
            library.join("R0000001.xmp"),
        )
        .unwrap();
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 1);
        assert!(dest.join("R0000001.xmp").is_file());
        assert!(!dest.join("R0000001.JPG.xmp").exists());
    }

    #[test]
    fn export_does_not_copy_a_shared_stem_sidecar() {
        let library = unique_dir("shared");
        let dest = unique_dir("shared-dest");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        write_file(&library.join("R0000001.DNG"), b"dng-bytes");
        write_file(&library.join("R0000001.xmp"), b"<x:xmpmeta/>");
        mark_picked(&library, "R0000001.JPG");
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 1);
        assert!(dest.join("R0000001.JPG").is_file());
        assert!(!dest.join("R0000001.DNG").exists());
        assert!(!dest.join("R0000001.xmp").exists());
        assert_eq!(
            fs::read(library.join("R0000001.xmp")).unwrap(),
            b"<x:xmpmeta/>"
        );
    }

    #[test]
    fn export_does_not_overwrite_an_existing_destination_file() {
        let library = unique_dir("conflict");
        let dest = unique_dir("conflict-dest");
        write_file(&library.join("R0000001.JPG"), b"new-bytes");
        write_file(&dest.join("R0000001.JPG"), b"old-bytes");
        mark_picked(&library, "R0000001.JPG");
        let source_before = fingerprint(&library.join("R0000001.JPG"));
        let dest_before = fingerprint(&dest.join("R0000001.JPG"));
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 0);
        assert_eq!(report.failed, 1);
        assert_eq!(report.items[0].status, ExportItemStatus::Error);
        assert!(!report.items[0].original_copied);
        assert!(report.items[0].message.contains("未覆盖"));
        assert_eq!(fingerprint(&dest.join("R0000001.JPG")), dest_before);
        assert_eq!(fingerprint(&library.join("R0000001.JPG")), source_before);
    }

    #[test]
    fn export_reports_a_partial_failure_when_the_sidecar_name_exists() {
        let library = unique_dir("partial");
        let dest = unique_dir("partial-dest");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        mark_picked(&library, "R0000001.JPG");
        write_file(&dest.join("R0000001.JPG.xmp"), b"existing-xmp");
        let source_before = fingerprint(&library.join("R0000001.JPG"));
        let xmp_before = fingerprint(&dest.join("R0000001.JPG.xmp"));
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 0);
        assert_eq!(report.failed, 1);
        assert_eq!(report.items[0].status, ExportItemStatus::Partial);
        assert!(report.items[0].original_copied);
        assert!(!report.items[0].sidecar_copied);
        assert_eq!(fingerprint(&dest.join("R0000001.JPG")), source_before);
        assert_eq!(fingerprint(&dest.join("R0000001.JPG.xmp")), xmp_before);
        assert_eq!(fingerprint(&library.join("R0000001.JPG")), source_before);
    }

    #[test]
    fn export_rejects_the_library_folder_as_the_destination() {
        let library = unique_dir("same");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        mark_picked(&library, "R0000001.JPG");
        let before = fingerprint(&library.join("R0000001.JPG"));
        let err = export_picked_photos(&library, &library, None, |_| {}).unwrap_err();
        assert!(err.to_string().contains("当前保存位置"));
        assert_eq!(fingerprint(&library.join("R0000001.JPG")), before);
        assert!(library.join("R0000001.JPG.xmp").is_file());
    }

    #[test]
    fn export_rejects_a_file_path_as_the_destination() {
        let library = unique_dir("filedest");
        let dest_dir = unique_dir("filedest-wrap");
        let dest = dest_dir.join("not-a-folder");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        write_file(&dest, b"nope");
        mark_picked(&library, "R0000001.JPG");
        let err = export_picked_photos(&library, &dest, None, |_| {}).unwrap_err();
        assert!(err.to_string().contains("文件夹"));
    }

    #[test]
    fn export_fails_a_missing_original_without_creating_a_destination() {
        let library = unique_dir("missing");
        let dest = unique_dir("missing-dest");
        let photo = ImportedPhoto {
            file: "R0000001.JPG".to_string(),
            size: None,
            path: library.join("R0000001.JPG"),
            previewable: true,
        };
        let item = export_one(&library, &dest, &photo, &["R0000001.JPG".to_string()]);
        assert_eq!(item.status, ExportItemStatus::Error);
        assert!(!item.original_copied);
        assert!(fs::read_dir(&dest).unwrap().next().is_none());
    }

    #[test]
    fn export_does_not_follow_a_destination_symlink() {
        let library = unique_dir("symlink");
        let dest = unique_dir("symlink-dest");
        let outside = unique_dir("symlink-target");
        let target = outside.join("secret.bin");
        write_file(&target, b"keep-me");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        std::os::unix::fs::symlink(&target, dest.join("R0000001.JPG")).unwrap();
        mark_picked(&library, "R0000001.JPG");
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.failed, 1);
        assert_eq!(fs::read(&target).unwrap(), b"keep-me");
        assert_eq!(
            fs::read(library.join("R0000001.JPG")).unwrap(),
            b"jpeg-bytes"
        );
    }

    #[test]
    fn export_leaves_no_partial_file_when_the_destination_is_not_writable() {
        let library = unique_dir("perm");
        let dest = unique_dir("perm-dest");
        write_file(&library.join("R0000001.JPG"), b"jpeg-bytes");
        mark_picked(&library, "R0000001.JPG");
        let mut permissions = fs::metadata(&dest).unwrap().permissions();
        permissions.set_mode(0o555);
        fs::set_permissions(&dest, permissions).unwrap();
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        let mut entries = fs::read_dir(&dest).unwrap();
        let leftover = entries.next();
        let mut restore = fs::metadata(&dest).unwrap().permissions();
        restore.set_mode(0o755);
        let _ = fs::set_permissions(&dest, restore);
        assert_eq!(report.failed, 1);
        assert!(!report.items[0].original_copied);
        assert!(leftover.is_none(), "leftover: {leftover:?}");
    }

    #[test]
    fn exclusive_copy_does_not_overwrite() {
        let dir = unique_dir("exclusive");
        let src = dir.join("src.bin");
        let dest = dir.join("dest.bin");
        write_file(&src, b"src");
        write_file(&dest, b"dest");
        let err = copy_file_exclusive(&src, &dest).unwrap_err();
        assert!(matches!(err, CopyError::AlreadyExists));
        assert_eq!(fs::read(&dest).unwrap(), b"dest");
    }

    #[test]
    fn a_path_outside_the_destination_is_rejected() {
        let dest = unique_dir("escape");
        assert!(!is_inside_dir(&dest, &dest.join("..").join("outside.bin")));
        assert!(is_inside_dir(&dest, &dest.join("R0000001.JPG")));
    }

    #[test]
    fn name_exists_sees_a_symlink() {
        let dir = unique_dir("name-exists");
        let target = dir.join("target.bin");
        write_file(&target, b"x");
        let link = dir.join("link.bin");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(name_exists(&link).unwrap());
    }

    #[test]
    fn only_picked_photographs_are_exported_among_siblings() {
        let library = unique_dir("picked-only");
        let dest = unique_dir("picked-only-dest");
        write_file(&library.join("R0000001.JPG"), b"one");
        write_file(&library.join("R0000002.DNG"), b"two");
        write_file(&library.join("R0000003.JPG"), b"three");
        mark_picked(&library, "R0000001.JPG");
        mark_picked(&library, "R0000003.JPG");
        let report = export_picked_photos(&library, &dest, None, |_| {}).unwrap();
        assert_eq!(report.exported, 2);
        assert!(dest.join("R0000001.JPG").is_file());
        assert!(dest.join("R0000003.JPG").is_file());
        assert!(!dest.join("R0000002.DNG").exists());
    }

    #[test]
    fn export_reports_progress_for_each_picked_photograph() {
        let library = unique_dir("progress");
        let dest = unique_dir("progress-dest");
        write_file(&library.join("R0000001.JPG"), b"one");
        write_file(&library.join("R0000003.JPG"), b"three");
        mark_picked(&library, "R0000001.JPG");
        mark_picked(&library, "R0000003.JPG");
        let mut seen = Vec::new();
        let report = export_picked_photos(&library, &dest, None, |progress| {
            seen.push((progress.current, progress.total, progress.file.clone()));
        })
        .unwrap();
        assert_eq!(report.exported, 2);
        assert_eq!(
            seen,
            vec![
                (1, 2, "R0000001.JPG".to_string()),
                (2, 2, "R0000003.JPG".to_string()),
            ]
        );
    }
}
