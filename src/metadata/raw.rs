//! Read-only RAW develop of a DNG file through macOS CIRAWFilter.
//!
//! The original photograph is only read. Developed JPEGs are written to a
//! dedicated cache directory, never beside the original. This is a rendered
//! display image, not a linear sensor histogram and not an "upgraded"
//! embedded preview.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use super::histogram;
use super::preview;
use crate::album::file_url;
use crate::error::AppError;
use crate::metadata::PhotoHistogram;

/// Bump this when the develop pipeline or default size policy changes, so
/// cached JPEGs from an earlier renderer are not reused.
pub const RAW_RENDER_VERSION: u32 = 1;

/// Long-edge cap for the detail-page display raster. This is a UI downsample,
/// not the photograph's pixel size, and not a claim that the render is a
/// higher-resolution substitute for the embedded JPEG.
pub const RAW_MAX_LONG_EDGE: u32 = 4096;

const MIN_RENDERED_EDGE: u32 = 64;

static DEVELOP_LOCK: Mutex<()> = Mutex::new(());
static RAW_TMP_SEQ: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone)]
pub struct RawPreview {
    pub preview_url: String,
    pub preview_source: String,
    pub rendered_width: u32,
    pub rendered_height: u32,
    pub histogram: PhotoHistogram,
}

pub fn cache_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("raw-preview-cache")
}

fn is_dng(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("dng"))
}

fn raw_cache_file(dir: &Path, source: &Path, size: u64, mtime: u64) -> PathBuf {
    let base = preview::cache_file(dir, source, size, mtime);
    let file_name = format!(
        "{}-raw-v{RAW_RENDER_VERSION}-e{RAW_MAX_LONG_EDGE}.jpg",
        base.file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("photo")
    );
    dir.join(file_name)
}

fn cached_raw_jpeg(source: &Path, cache_dir: &Path, size: u64, mtime: u64) -> Option<PathBuf> {
    let dest = raw_cache_file(cache_dir, source, size, mtime);
    (dest.is_file() && header_looks_like_jpeg(&dest)).then_some(dest)
}

fn header_looks_like_jpeg(path: &Path) -> bool {
    use std::io::Read;
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };
    let mut header = [0u8; 3];
    file.read_exact(&mut header).is_ok()
        && header[0] == 0xFF
        && header[1] == 0xD8
        && header[2] == 0xFF
}

fn preview_from_jpeg_file(
    path: &Path,
    width: Option<u32>,
    height: Option<u32>,
) -> Option<RawPreview> {
    let bytes = fs::read(path).ok()?;
    let histogram = histogram::from_jpeg_bytes(&bytes)?;
    if histogram.red.len() != 256 || histogram.green.len() != 256 || histogram.blue.len() != 256 {
        return None;
    }
    let (width, height) = match (width, height) {
        (Some(width), Some(height)) => (width, height),
        _ => {
            let image = image::load_from_memory(&bytes).ok()?;
            image::GenericImageView::dimensions(&image)
        }
    };
    if !rendered_size_is_usable(width, height) {
        return None;
    }
    Some(RawPreview {
        preview_url: file_url(path),
        preview_source: "raw".to_string(),
        rendered_width: width,
        rendered_height: height,
        histogram: PhotoHistogram {
            red: histogram.red.into_iter().map(f64::from).collect(),
            green: histogram.green.into_iter().map(f64::from).collect(),
            blue: histogram.blue.into_iter().map(f64::from).collect(),
            source: "raw".to_string(),
        },
    })
}

fn rendered_size_is_usable(width: u32, height: u32) -> bool {
    width >= MIN_RENDERED_EDGE
        && height >= MIN_RENDERED_EDGE
        && width <= RAW_MAX_LONG_EDGE
        && height <= RAW_MAX_LONG_EDGE
}

/// Develop `path` with CIRAWFilter and cache a display JPEG under `cache_dir`.
///
/// The original file is only read. Non-DNG files, corrupt files, and hosts
/// without CIRAWFilter return an error so the caller can keep an embedded
/// preview.
pub fn develop_raw_preview(path: &Path, cache_dir: &Path) -> Result<RawPreview, AppError> {
    let metadata = fs::metadata(path).map_err(|err| AppError::io("无法读取这张照片", err))?;
    if !metadata.is_file() {
        return Err(AppError::msg("找不到这张照片。"));
    }
    if !is_dng(path) {
        return Err(AppError::msg("只有 DNG 才能从 RAW 显影。"));
    }
    let size = metadata.len();
    let mtime = preview::mtime_secs(&metadata);
    if let Some(cached) = cached_raw_jpeg(path, cache_dir, size, mtime)
        && let Some(preview) = preview_from_jpeg_file(&cached, None, None)
    {
        return Ok(preview);
    }

    let _guard = DEVELOP_LOCK.lock().unwrap_or_else(|err| err.into_inner());
    if let Some(cached) = cached_raw_jpeg(path, cache_dir, size, mtime)
        && let Some(preview) = preview_from_jpeg_file(&cached, None, None)
    {
        return Ok(preview);
    }

    let developed = develop_dng(path, RAW_MAX_LONG_EDGE)?;
    let after = fs::metadata(path).ok();
    if after.as_ref().is_some_and(|info| info.len() != size) {
        return Err(AppError::msg("无法读取这张照片。"));
    }
    if !rendered_size_is_usable(developed.width, developed.height) {
        return Err(AppError::msg("RAW 显影结果尺寸不可用。"));
    }
    let dest = raw_cache_file(cache_dir, path, size, mtime);
    let stored = store_raw_jpeg(&dest, cache_dir, &developed.bytes)
        .ok_or_else(|| AppError::msg("无法保存 RAW 预览。"))?;
    preview_from_jpeg_file(&stored, Some(developed.width), Some(developed.height))
        .ok_or_else(|| AppError::msg("无法读取 RAW 预览。"))
}

fn store_raw_jpeg(dest: &Path, dir: &Path, jpeg: &[u8]) -> Option<PathBuf> {
    if jpeg.len() < 3 || jpeg[0] != 0xFF || jpeg[1] != 0xD8 || jpeg[2] != 0xFF {
        return None;
    }
    fs::create_dir_all(dir).ok()?;
    if dest.is_file()
        && dest
            .metadata()
            .ok()
            .is_some_and(|info| info.len() == jpeg.len() as u64)
        && header_looks_like_jpeg(dest)
    {
        return Some(dest.to_path_buf());
    }
    let tmp = dir.join(format!(
        ".{name}.{pid}.{seq}.partial",
        name = dest
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("raw"),
        pid = std::process::id(),
        seq = RAW_TMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&tmp, jpeg).ok()?;
    match fs::rename(&tmp, dest) {
        Ok(()) => Some(dest.to_path_buf()),
        Err(_) => {
            let _ = fs::remove_file(&tmp);
            dest.is_file().then(|| dest.to_path_buf())
        }
    }
}

struct DevelopedJpeg {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

fn develop_dng(path: &Path, max_long_edge: u32) -> Result<DevelopedJpeg, AppError> {
    develop_dng_impl(path, max_long_edge)
}

#[cfg(target_os = "macos")]
fn develop_dng_impl(path: &Path, max_long_edge: u32) -> Result<DevelopedJpeg, AppError> {
    use std::ffi::CString;

    let c_path = path
        .to_str()
        .and_then(|value| CString::new(value).ok())
        .ok_or_else(|| AppError::msg("无法读取这张照片。"))?;
    let mut out = ffi::RicohRawJpeg {
        bytes: std::ptr::null_mut(),
        len: 0,
        width: 0,
        height: 0,
    };
    let mut err = [0i8; 256];
    let status = unsafe {
        ffi::ricoh_raw_develop_dng(
            c_path.as_ptr(),
            max_long_edge,
            &mut out,
            err.as_mut_ptr(),
            err.len(),
        )
    };
    let message = ffi_message(&err);
    if status != 0 {
        unsafe {
            ffi::ricoh_raw_jpeg_free(&mut out);
        }
        return Err(if status == 2 {
            AppError::msg("当前系统不支持 RAW 显影。")
        } else {
            AppError::msg("无法从这张 DNG 显影 RAW。")
        });
    }
    if out.bytes.is_null() || out.len == 0 {
        unsafe {
            ffi::ricoh_raw_jpeg_free(&mut out);
        }
        return Err(AppError::msg("无法从这张 DNG 显影 RAW。"));
    }
    let bytes = unsafe { std::slice::from_raw_parts(out.bytes, out.len) }.to_vec();
    let width = out.width;
    let height = out.height;
    unsafe {
        ffi::ricoh_raw_jpeg_free(&mut out);
    }
    if bytes.len() < 3 || bytes[0] != 0xFF || bytes[1] != 0xD8 || bytes[2] != 0xFF {
        return Err(AppError::msg("无法从这张 DNG 显影 RAW。"));
    }
    let _ = message;
    Ok(DevelopedJpeg {
        bytes,
        width,
        height,
    })
}

#[cfg(not(target_os = "macos"))]
fn develop_dng_impl(_path: &Path, _max_long_edge: u32) -> Result<DevelopedJpeg, AppError> {
    Err(AppError::msg("当前系统不支持 RAW 显影。"))
}

#[cfg(target_os = "macos")]
fn ffi_message(err: &[i8]) -> String {
    let bytes: Vec<u8> = err
        .iter()
        .map(|value| *value as u8)
        .take_while(|value| *value != 0)
        .collect();
    String::from_utf8_lossy(&bytes).into_owned()
}

#[cfg(target_os = "macos")]
mod ffi {
    use std::os::raw::{c_char, c_int};

    #[repr(C)]
    pub struct RicohRawJpeg {
        pub bytes: *mut u8,
        pub len: usize,
        pub width: u32,
        pub height: u32,
    }

    unsafe extern "C" {
        pub fn ricoh_raw_develop_dng(
            path: *const c_char,
            max_long_edge: u32,
            out: *mut RicohRawJpeg,
            err: *mut c_char,
            err_len: usize,
        ) -> c_int;

        pub fn ricoh_raw_jpeg_free(image: *mut RicohRawJpeg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metadata::preview::test_dng_with_preview;
    use image::{ImageFormat, Rgb, RgbImage};
    use std::io::Cursor;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir(label: &str) -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let seq = SEQ.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("ricoh-mac-raw-{label}-{nanos}-{seq}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn solid_jpeg(r: u8, g: u8, b: u8) -> Vec<u8> {
        let mut image = RgbImage::new(8, 8);
        for pixel in image.pixels_mut() {
            *pixel = Rgb([r, g, b]);
        }
        let mut cursor = Cursor::new(Vec::new());
        image
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .expect("encode jpeg");
        cursor.into_inner()
    }

    fn public_iiix_dng() -> Option<PathBuf> {
        let path = PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join(
            "Library/Caches/ricoh-mac/gr-iiix-samples/pixls-us/Ricoh - GR IIIx - 14bit (3:2).DNG",
        );
        let ok = path.is_file()
            && fs::metadata(&path)
                .map(|info| info.len() == 31_357_843)
                .unwrap_or(false);
        ok.then_some(path)
    }

    #[test]
    fn corrupt_and_synthetic_dngs_do_not_develop() {
        let dir = unique_dir("fallback");
        let cache = dir.join("cache");
        let corrupt = dir.join("corrupt.DNG");
        fs::write(&corrupt, b"not-a-dng").unwrap();
        let before = fs::read(&corrupt).unwrap();
        assert!(develop_raw_preview(&corrupt, &cache).is_err());
        assert_eq!(fs::read(&corrupt).unwrap(), before);

        let jpeg = solid_jpeg(20, 40, 80);
        let synthetic = dir.join("preview-only.DNG");
        fs::write(&synthetic, test_dng_with_preview(&jpeg, 8, 8)).unwrap();
        let before = fs::read(&synthetic).unwrap();
        assert!(develop_raw_preview(&synthetic, &cache).is_err());
        assert_eq!(fs::read(&synthetic).unwrap(), before);
    }

    #[test]
    fn jpeg_is_not_developed_as_raw() {
        let dir = unique_dir("jpeg");
        let path = dir.join("R0000001.JPG");
        fs::write(&path, solid_jpeg(10, 10, 10)).unwrap();
        let err = develop_raw_preview(&path, &dir.join("cache"))
            .unwrap_err()
            .to_string();
        assert!(err.contains("DNG"), "{err}");
    }

    #[test]
    fn public_iiix_dng_develops_a_usable_raster_when_present() {
        let Some(source) = public_iiix_dng() else {
            return;
        };
        let dir = unique_dir("iiix");
        let library = dir.join("library");
        let cache = dir.join("cache");
        fs::create_dir_all(&library).unwrap();
        let linked = library.join("Ricoh-GR-IIIx-14bit.DNG");
        // A symlink would canonicalize outside the library and be rejected, which
        // is correct. Hard-link or copy so the backend entry sees a library path.
        if fs::hard_link(&source, &linked).is_err() {
            fs::copy(&source, &linked).unwrap();
        }
        assert!(
            crate::metadata::develop_library_raw_preview(&library, &source, &cache).is_err(),
            "photos outside the library must be rejected"
        );
        let before = fs::metadata(&source).unwrap();
        let first = crate::metadata::develop_library_raw_preview(&library, &linked, &cache)
            .expect("develop cc0 dng through the library entry");
        let after = fs::metadata(&source).unwrap();
        assert_eq!(before.len(), after.len());
        assert_eq!(first.preview_source, "raw");
        assert!(
            rendered_size_is_usable(first.rendered_width, first.rendered_height),
            "rendered {}x{}",
            first.rendered_width,
            first.rendered_height
        );
        let long = first.rendered_width.max(first.rendered_height);
        let short = first.rendered_width.min(first.rendered_height);
        assert!(
            long >= 1024,
            "long edge {long} is too small for a detail preview"
        );
        assert!(long <= RAW_MAX_LONG_EDGE, "long edge {long}");
        let aspect = f64::from(long) / f64::from(short);
        assert!(
            (aspect - 1.5).abs() < 0.08,
            "expected a 3:2 raster, got {}x{}",
            first.rendered_width,
            first.rendered_height
        );
        assert_eq!(first.histogram.source, "raw");
        assert_eq!(first.histogram.red.len(), 256);
        assert_eq!(first.histogram.green.len(), 256);
        assert_eq!(first.histogram.blue.len(), 256);
        let red_total: f64 = first.histogram.red.iter().sum();
        let green_total: f64 = first.histogram.green.iter().sum();
        let blue_total: f64 = first.histogram.blue.iter().sum();
        assert!(red_total > 0.0 && green_total > 0.0 && blue_total > 0.0);
        let occupied = first
            .histogram
            .red
            .iter()
            .chain(first.histogram.green.iter())
            .chain(first.histogram.blue.iter())
            .filter(|value| **value > 0.0)
            .count();
        assert!(
            occupied > 16,
            "histogram looks collapsed: {occupied} occupied bins"
        );

        let cached = crate::metadata::develop_library_raw_preview(&library, &linked, &cache)
            .expect("cache hit");
        assert_eq!(cached.preview_url, first.preview_url);
        assert_eq!(cached.rendered_width, first.rendered_width);
        assert_eq!(cached.rendered_height, first.rendered_height);

        let artifact_dir = PathBuf::from(std::env::var_os("HOME").unwrap_or_default())
            .join("Library/Caches/ricoh-mac/gr-iiix-samples/artifacts");
        let _ = fs::create_dir_all(&artifact_dir);
        let artifact = artifact_dir.join("pixls-griiix-raw-preview-v1.jpg");
        if let Some(file) = cached.preview_url.strip_prefix("file://") {
            let decoded = urlencoding::decode_or_plain(file);
            if let Ok(bytes) = fs::read(&decoded) {
                let _ = fs::write(&artifact, bytes);
            }
        }
    }
}

#[cfg(test)]
mod urlencoding {
    pub fn decode_or_plain(file: &str) -> std::path::PathBuf {
        let replaced = file.replace("%20", " ");
        std::path::PathBuf::from(replaced)
    }
}
