//! Read-only extraction of an embedded JPEG preview from a TIFF/DNG file.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

use super::tiff::{Endian, IfdEntry, tiff_header, walk_ifds};
use crate::error::AppError;

const TAG_IMAGE_WIDTH: u16 = 0x0100;
const TAG_IMAGE_LENGTH: u16 = 0x0101;
const TAG_COMPRESSION: u16 = 0x0103;
const TAG_PHOTOMETRIC: u16 = 0x0106;
const TAG_STRIP_OFFSETS: u16 = 0x0111;
const TAG_STRIP_BYTE_COUNTS: u16 = 0x0117;
const TAG_JPEG_OFFSET: u16 = 0x0201;
const TAG_JPEG_LENGTH: u16 = 0x0202;
const COMPRESSION_OLD_JPEG: u32 = 6;
const COMPRESSION_JPEG: u32 = 7;
const PHOTO_CFA: u32 = 32803;

#[derive(Debug, Clone)]
pub struct EmbeddedJpeg {
    pub bytes: Vec<u8>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

pub fn extract_jpeg(data: &[u8]) -> Option<EmbeddedJpeg> {
    let (endian, ifd0) = tiff_header(data)?;
    let ifds = walk_ifds(data, ifd0, endian);
    let mut best: Option<EmbeddedJpeg> = None;
    let mut best_area: u64 = 0;
    for (_, entries) in ifds {
        if is_cfa(&entries, data, endian) {
            continue;
        }
        if let Some(jpeg) = jpeg_from_ifd(data, &entries, endian) {
            let area = u64::from(jpeg.width.unwrap_or(0)) * u64::from(jpeg.height.unwrap_or(0));
            let score = if area == 0 { 1 } else { area };
            if best.is_none() || score >= best_area {
                best_area = score;
                best = Some(jpeg);
            }
        }
    }
    best
}

fn is_cfa(entries: &[(IfdEntry, usize)], data: &[u8], endian: Endian) -> bool {
    entries.iter().any(|(entry, offset)| {
        entry.tag == TAG_PHOTOMETRIC
            && entry.first_u32_from(data, *offset, endian) == Some(PHOTO_CFA)
    })
}

fn tag_u32(entries: &[(IfdEntry, usize)], data: &[u8], endian: Endian, tag: u16) -> Option<u32> {
    entries
        .iter()
        .find(|(entry, _)| entry.tag == tag)
        .and_then(|(entry, offset)| entry.first_u32_from(data, *offset, endian))
}

fn jpeg_from_ifd(
    data: &[u8],
    entries: &[(IfdEntry, usize)],
    endian: Endian,
) -> Option<EmbeddedJpeg> {
    let width = tag_u32(entries, data, endian, TAG_IMAGE_WIDTH);
    let height = tag_u32(entries, data, endian, TAG_IMAGE_LENGTH);
    let compression = tag_u32(entries, data, endian, TAG_COMPRESSION);
    if let (Some(offset), Some(length)) = (
        tag_u32(entries, data, endian, TAG_JPEG_OFFSET),
        tag_u32(entries, data, endian, TAG_JPEG_LENGTH),
    ) && length > 0
        && let Some(bytes) = slice_jpeg(data, offset as usize, length as usize)
    {
        return Some(EmbeddedJpeg {
            bytes,
            width,
            height,
        });
    }
    if (compression == Some(COMPRESSION_JPEG) || compression == Some(COMPRESSION_OLD_JPEG))
        && let Some(bytes) = jpeg_from_strips(data, entries, endian)
    {
        return Some(EmbeddedJpeg {
            bytes,
            width,
            height,
        });
    }
    None
}

fn jpeg_from_strips(data: &[u8], entries: &[(IfdEntry, usize)], endian: Endian) -> Option<Vec<u8>> {
    let (offsets_entry, offsets_at) = entries
        .iter()
        .find(|(entry, _)| entry.tag == TAG_STRIP_OFFSETS)?;
    let (counts_entry, counts_at) = entries
        .iter()
        .find(|(entry, _)| entry.tag == TAG_STRIP_BYTE_COUNTS)?;
    let offsets = offsets_entry.u32_list(data, *offsets_at, endian)?;
    let counts = counts_entry.u32_list(data, *counts_at, endian)?;
    if offsets.len() != counts.len() || offsets.is_empty() || offsets.len() > 64 {
        return None;
    }
    let mut bytes = Vec::new();
    for (offset, count) in offsets.into_iter().zip(counts) {
        let start = offset as usize;
        let end = start.checked_add(count as usize)?;
        bytes.extend_from_slice(data.get(start..end)?);
    }
    if looks_like_jpeg(&bytes) {
        Some(bytes)
    } else {
        None
    }
}

fn slice_jpeg(data: &[u8], offset: usize, length: usize) -> Option<Vec<u8>> {
    let end = offset.checked_add(length)?;
    let bytes = data.get(offset..end)?;
    if looks_like_jpeg(bytes) {
        Some(bytes.to_vec())
    } else {
        None
    }
}

fn looks_like_jpeg(bytes: &[u8]) -> bool {
    bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

fn is_dng(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("dng"))
}

pub fn mtime_secs(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn safe_file_name(source: &Path) -> String {
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("photo");
    name.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn path_tag(source: &Path) -> String {
    let bytes = source.to_string_lossy();
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn cache_file(dir: &Path, source: &Path, size: u64, mtime: u64) -> PathBuf {
    let safe = safe_file_name(source);
    let tag = path_tag(source);
    dir.join(format!("{safe}-{tag}-{size}-{mtime}.jpg"))
}

fn header_looks_like_jpeg(path: &Path) -> bool {
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };
    let mut header = [0u8; 4];
    file.read_exact(&mut header).is_ok() && looks_like_jpeg(&header)
}

/// Returns a cached embedded JPEG when the source size and mtime still match.
pub fn cached_for_file(source: &Path, cache_dir: &Path) -> Option<PathBuf> {
    let metadata = fs::metadata(source).ok()?;
    if !metadata.is_file() {
        return None;
    }
    let dest = cache_file(cache_dir, source, metadata.len(), mtime_secs(&metadata));
    dest.is_file()
        .then_some(dest)
        .filter(|path| header_looks_like_jpeg(path))
}

/// Writes an extracted JPEG into `cache_dir`. The original photograph is not touched.
pub fn store_jpeg(
    dir: &Path,
    source: &Path,
    size: u64,
    mtime: u64,
    jpeg: &[u8],
) -> Option<PathBuf> {
    if !looks_like_jpeg(jpeg) {
        return None;
    }
    fs::create_dir_all(dir).ok()?;
    let dest = cache_file(dir, source, size, mtime);
    if dest.is_file()
        && dest
            .metadata()
            .ok()
            .is_some_and(|info| info.len() == jpeg.len() as u64)
        && header_looks_like_jpeg(&dest)
    {
        return Some(dest);
    }
    static TMP_SEQ: AtomicU64 = AtomicU64::new(0);
    let tmp = dir.join(format!(
        ".{safe}-{tag}-{size}-{mtime}.{pid}.{seq}.partial",
        safe = safe_file_name(source),
        tag = path_tag(source),
        pid = std::process::id(),
        seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&tmp, jpeg).ok()?;
    match fs::rename(&tmp, &dest) {
        Ok(()) => Some(dest),
        Err(_) => {
            let _ = fs::remove_file(&tmp);
            None
        }
    }
}

/// Returns a cached or newly extracted embedded JPEG for a DNG.
///
/// The original file is only read. JPEG and other raster originals are not
/// copied into the cache. Missing or unusable previews yield `Ok(None)`.
pub fn load_cached_jpeg(path: &Path, cache_dir: &Path) -> Result<Option<PathBuf>, AppError> {
    let metadata = fs::metadata(path).map_err(|err| AppError::io("无法读取这张照片", err))?;
    if !metadata.is_file() {
        return Err(AppError::msg("找不到这张照片。"));
    }
    let size = metadata.len();
    let mtime = mtime_secs(&metadata);
    if let Some(cached) = cached_for_file(path, cache_dir) {
        return Ok(Some(cached));
    }
    if !is_dng(path) {
        return Ok(None);
    }
    let bytes = fs::read(path).map_err(|err| AppError::io("无法读取这张照片", err))?;
    let after = fs::metadata(path).ok();
    if after.as_ref().is_some_and(|info| info.len() != size) {
        return Err(AppError::msg("无法读取这张照片。"));
    }
    let Some(preview) = extract_jpeg(&bytes) else {
        return Ok(None);
    };
    Ok(store_jpeg(cache_dir, path, size, mtime, &preview.bytes))
}

/// Builds a little-endian TIFF with one IFD that stores an embedded JPEG preview.
#[cfg(test)]
pub fn test_dng_with_preview(jpeg: &[u8], width: u32, height: u32) -> Vec<u8> {
    let ifd_count = 6u16;
    // 8 header + 2 count + 6*12 entries + 4 next = 8+2+72+4 = 86, then jpeg
    let jpeg_offset = 86u32;
    let mut data = vec![b'I', b'I', 42, 0, 8, 0, 0, 0];
    data.extend_from_slice(&ifd_count.to_le_bytes());
    fn entry(tag: u16, typ: u16, count: u32, value: u32) -> Vec<u8> {
        let mut out = Vec::with_capacity(12);
        out.extend_from_slice(&tag.to_le_bytes());
        out.extend_from_slice(&typ.to_le_bytes());
        out.extend_from_slice(&count.to_le_bytes());
        out.extend_from_slice(&value.to_le_bytes());
        out
    }
    // NewSubfileType = 1 (preview)
    data.extend(entry(0x00FE, 4, 1, 1));
    data.extend(entry(TAG_IMAGE_WIDTH, 4, 1, width));
    data.extend(entry(TAG_IMAGE_LENGTH, 4, 1, height));
    data.extend(entry(TAG_COMPRESSION, 3, 1, COMPRESSION_JPEG));
    data.extend(entry(TAG_JPEG_OFFSET, 4, 1, jpeg_offset));
    data.extend(entry(TAG_JPEG_LENGTH, 4, 1, jpeg.len() as u32));
    data.extend_from_slice(&[0, 0, 0, 0]);
    assert_eq!(data.len(), jpeg_offset as usize);
    data.extend_from_slice(jpeg);
    data
}

#[cfg(test)]
mod tests {
    use super::{
        cached_for_file, extract_jpeg, load_cached_jpeg, store_jpeg, test_dng_with_preview,
    };
    use image::{ImageFormat, Rgb, RgbImage};
    use std::fs;
    use std::io::Cursor;
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
            "ricoh-mac-preview-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn tiny_jpeg() -> Vec<u8> {
        let mut image = RgbImage::new(4, 4);
        for pixel in image.pixels_mut() {
            *pixel = Rgb([10, 20, 30]);
        }
        let mut cursor = Cursor::new(Vec::new());
        image
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .expect("jpeg");
        cursor.into_inner()
    }

    fn snapshot(path: &std::path::Path) -> (u64, Vec<u8>) {
        (path.metadata().unwrap().len(), fs::read(path).unwrap())
    }

    #[test]
    fn extracts_the_largest_embedded_jpeg() {
        let jpeg = tiny_jpeg();
        let dng = test_dng_with_preview(&jpeg, 4, 4);
        let extracted = extract_jpeg(&dng).expect("preview");
        assert_eq!(extracted.width, Some(4));
        assert_eq!(extracted.height, Some(4));
        assert_eq!(extracted.bytes, jpeg);
    }

    #[test]
    fn rejects_non_jpeg_payloads() {
        let dng = test_dng_with_preview(&[0, 1, 2, 3, 4], 4, 4);
        assert!(extract_jpeg(&dng).is_none());
        let mut damaged = dng;
        damaged[0] = 0;
        assert!(extract_jpeg(&damaged).is_none());
    }

    #[test]
    fn extracts_and_reuses_a_cache_file_without_writing_the_original() {
        let jpeg = tiny_jpeg();
        let dng = test_dng_with_preview(&jpeg, 4, 4);
        let dir = unique_dir("cache-hit");
        let path = dir.join("R0000002.DNG");
        fs::write(&path, &dng).unwrap();
        let cache = dir.join("cache");
        let before = snapshot(&path);
        let first = load_cached_jpeg(&path, &cache).unwrap().expect("preview");
        assert_eq!(snapshot(&path), before);
        assert_eq!(fs::read(&first).unwrap(), jpeg);
        let first_meta = first.metadata().unwrap();
        let second = load_cached_jpeg(&path, &cache).unwrap().expect("cached");
        assert_eq!(second, first);
        let second_meta = second.metadata().unwrap();
        assert_eq!(
            first_meta.modified().unwrap(),
            second_meta.modified().unwrap()
        );
        assert_eq!(first_meta.len(), second_meta.len());
        let cached_count = fs::read_dir(&cache)
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .ok()
                    .and_then(|item| item.path().extension().map(|ext| ext == "jpg"))
                    .unwrap_or(false)
            })
            .count();
        assert_eq!(cached_count, 1);
        assert_eq!(snapshot(&path), before);
    }

    #[test]
    fn ignores_stale_or_corrupt_cache_files() {
        let jpeg = tiny_jpeg();
        let dng = test_dng_with_preview(&jpeg, 4, 4);
        let dir = unique_dir("cache-invalid");
        let path = dir.join("R0000002.DNG");
        fs::write(&path, &dng).unwrap();
        let cache = dir.join("cache");
        let first = load_cached_jpeg(&path, &cache).unwrap().expect("preview");
        fs::write(&first, b"not-a-jpeg").unwrap();
        assert!(cached_for_file(&path, &cache).is_none());
        let recovered = load_cached_jpeg(&path, &cache).unwrap().expect("recovered");
        assert_eq!(fs::read(&recovered).unwrap(), jpeg);

        fs::write(&path, [dng.as_slice(), b"x"].concat()).unwrap();
        let after_change = load_cached_jpeg(&path, &cache).unwrap().expect("new size");
        assert_ne!(after_change, recovered);
        assert_eq!(fs::read(&after_change).unwrap(), jpeg);
    }

    #[test]
    fn returns_none_when_a_dng_has_no_usable_preview() {
        let dir = unique_dir("no-preview");
        let path = dir.join("R0000002.DNG");
        fs::write(&path, b"not-a-dng").unwrap();
        let before = snapshot(&path);
        let cache = dir.join("cache");
        assert!(load_cached_jpeg(&path, &cache).unwrap().is_none());
        assert_eq!(snapshot(&path), before);
        assert!(!cache.exists() || cache.read_dir().unwrap().next().is_none());
    }

    #[test]
    fn cache_keys_include_the_source_path() {
        let jpeg = tiny_jpeg();
        let dng = test_dng_with_preview(&jpeg, 4, 4);
        let dir = unique_dir("path-key");
        let left = dir.join("a");
        let right = dir.join("b");
        fs::create_dir_all(&left).unwrap();
        fs::create_dir_all(&right).unwrap();
        let left_path = left.join("R0000002.DNG");
        let right_path = right.join("R0000002.DNG");
        fs::write(&left_path, &dng).unwrap();
        fs::write(&right_path, &dng).unwrap();
        let cache = dir.join("cache");
        let left_cached = store_jpeg(
            &cache,
            &left_path,
            left_path.metadata().unwrap().len(),
            1,
            &jpeg,
        )
        .unwrap();
        let right_cached = store_jpeg(
            &cache,
            &right_path,
            right_path.metadata().unwrap().len(),
            1,
            &jpeg,
        )
        .unwrap();
        assert_ne!(left_cached, right_cached);
    }
}
