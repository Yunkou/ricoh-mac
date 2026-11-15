//! Read-only photographer information for a library photograph.
//!
//! This module never writes back to the original JPEG or DNG file.

mod format;
mod histogram;
mod makernote;
mod preview;
mod tiff;

use std::fs;
use std::io::{BufReader, Cursor};
use std::path::{Path, PathBuf};

use exif::{DateTime, Exif, Field, In, Reader, Tag, Value};
use nsh_core::prelude::*;

use crate::album::file_url;
use crate::error::AppError;
use format::{
    aspect_ratio, color_space_key, dms_to_degrees, exposure_mode_key, format_aperture, format_ev,
    format_focal_35mm, format_focal_mm, format_gps, format_iso, format_kelvin, format_shutter,
    format_taken_at, iiix_crop_from_35mm, is_gr_iiix, metering_mode_key,
};

/// Photographer-facing information for one photograph.
#[derive(Debug, Clone, JsObject)]
pub struct PhotoDetails {
    /// Original file name.
    pub file: String,
    /// `jpeg`, `dng`, or `other`.
    pub format: String,
    /// Size in bytes, when known.
    pub size: Option<f64>,
    /// Pixel width, when known.
    pub width: Option<f64>,
    /// Pixel height, when known.
    pub height: Option<f64>,
    /// Aspect ratio key such as `3:2` or `1:1`.
    pub aspect_ratio: Option<String>,
    /// `srgb` or `adobe_rgb`, when known.
    pub color_space: Option<String>,
    /// Capture time as `YYYY-MM-DD HH:MM:SS`, when recorded.
    pub taken_at: Option<String>,
    /// Aperture, such as `F2.8`.
    pub aperture: Option<String>,
    /// Shutter speed, such as `1/500`.
    pub shutter: Option<String>,
    /// ISO value, such as `400`.
    pub iso: Option<String>,
    /// Exposure compensation, such as `+0.3`.
    pub exposure_compensation: Option<String>,
    /// Exposure mode key.
    pub exposure_mode: Option<String>,
    /// Metering mode key.
    pub metering_mode: Option<String>,
    /// Camera make, when recorded.
    pub camera_make: Option<String>,
    /// Camera model, when recorded.
    pub camera_model: Option<String>,
    /// Lens description, when recorded or inferred.
    pub lens: Option<String>,
    /// Focal length, such as `18.3 mm`.
    pub focal_length: Option<String>,
    /// 35 mm equivalent focal length, such as `40 mm`.
    pub focal_length_35mm: Option<String>,
    /// Crop mode key. GR IIIx values are `off`, `crop_50`, or `crop_71`.
    pub crop_mode: Option<String>,
    /// White balance key.
    pub white_balance: Option<String>,
    /// Color temperature, such as `5200 K`.
    pub color_temperature: Option<String>,
    /// Image Control key.
    pub image_control: Option<String>,
    /// Focus mode key.
    pub focus_mode: Option<String>,
    /// `on` or `off` when Full Press Snap is recorded.
    pub full_press_snap: Option<String>,
    /// `on` or `off` when the ND filter is recorded.
    pub nd_filter: Option<String>,
    /// Geographic coordinates, only when the file contains GPS.
    pub gps: Option<String>,
    /// `file:` URL for the display image, when one is available.
    pub preview_url: Option<String>,
    /// `original` or `preview`.
    pub preview_source: Option<String>,
    /// RGB histogram, when a JPEG original or embedded preview can be decoded.
    pub histogram: Option<PhotoHistogram>,
}

/// RGB channel counts for a 256-bin histogram.
#[derive(Debug, Clone, JsObject)]
pub struct PhotoHistogram {
    pub red: Vec<f64>,
    pub green: Vec<f64>,
    pub blue: Vec<f64>,
    /// `original` or `preview`.
    pub source: String,
}

/// Read photographer information from `path`.
///
/// The original file is only read. If `preview_cache_dir` is set, an extracted
/// DNG preview may be written there as a JPEG, never into the original folder.
pub fn inspect_photo(
    path: &Path,
    preview_cache_dir: Option<&Path>,
) -> Result<PhotoDetails, AppError> {
    let metadata = fs::metadata(path).map_err(|err| AppError::io("无法读取这张照片", err))?;
    if !metadata.is_file() {
        return Err(AppError::msg("找不到这张照片。"));
    }
    let size = metadata.len();
    let mtime = preview::mtime_secs(&metadata);
    let file = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("photo")
        .to_string();
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let format = match ext.as_str() {
        "jpg" | "jpeg" => "jpeg",
        "dng" => "dng",
        _ => "other",
    }
    .to_string();

    let bytes = fs::read(path).map_err(|err| AppError::io("无法读取这张照片", err))?;
    let after = fs::metadata(path).ok();
    if after.as_ref().is_some_and(|info| info.len() != size) {
        return Err(AppError::msg("无法读取这张照片。"));
    }

    let exif = Reader::new()
        .read_from_container(&mut Cursor::new(&bytes))
        .ok()
        .or_else(|| {
            Reader::new()
                .read_from_container(&mut BufReader::new(fs::File::open(path).ok()?))
                .ok()
        });
    let mut details = PhotoDetails {
        file,
        format: format.clone(),
        size: Some(size as f64),
        width: None,
        height: None,
        aspect_ratio: None,
        color_space: None,
        taken_at: None,
        aperture: None,
        shutter: None,
        iso: None,
        exposure_compensation: None,
        exposure_mode: None,
        metering_mode: None,
        camera_make: None,
        camera_model: None,
        lens: None,
        focal_length: None,
        focal_length_35mm: None,
        crop_mode: None,
        white_balance: None,
        color_temperature: None,
        image_control: None,
        focus_mode: None,
        full_press_snap: None,
        nd_filter: None,
        gps: None,
        preview_url: None,
        preview_source: None,
        histogram: None,
    };
    if let Some(exif) = exif.as_ref() {
        fill_from_exif(&mut details, exif, &bytes);
    }

    if format == "jpeg" {
        details.preview_url = Some(file_url(path));
        details.preview_source = Some("original".to_string());
        if let Some(histogram) = histogram::from_jpeg_bytes(&bytes) {
            details.histogram = Some(to_photo_histogram(histogram, "original"));
        }
        fill_dimensions_from_histogram_image(&mut details, &bytes);
    } else if format == "dng"
        && let Some(preview) = preview::extract_jpeg(&bytes)
    {
        if details.width.is_none() {
            details.width = preview.width.map(f64::from);
        }
        if details.height.is_none() {
            details.height = preview.height.map(f64::from);
        }
        if let Some(histogram) = histogram::from_jpeg_bytes(&preview.bytes) {
            details.histogram = Some(to_photo_histogram(histogram, "preview"));
        }
        if let Some(dir) = preview_cache_dir
            && let Some(cached) = preview::store_jpeg(dir, path, size, mtime, &preview.bytes)
        {
            details.preview_url = Some(file_url(&cached));
            details.preview_source = Some("preview".to_string());
        }
    }

    if let (Some(width), Some(height)) = (details.width, details.height)
        && details.aspect_ratio.is_none()
    {
        details.aspect_ratio = aspect_ratio(width.round() as u32, height.round() as u32);
    }
    Ok(details)
}

fn fill_dimensions_from_histogram_image(details: &mut PhotoDetails, bytes: &[u8]) {
    if details.width.is_some() && details.height.is_some() {
        return;
    }
    if let Ok(image) = image::load_from_memory(bytes) {
        let (width, height) = image::GenericImageView::dimensions(&image);
        if details.width.is_none() {
            details.width = Some(f64::from(width));
        }
        if details.height.is_none() {
            details.height = Some(f64::from(height));
        }
    }
}

fn to_photo_histogram(histogram: histogram::Histogram, source: &str) -> PhotoHistogram {
    PhotoHistogram {
        red: histogram.red.into_iter().map(f64::from).collect(),
        green: histogram.green.into_iter().map(f64::from).collect(),
        blue: histogram.blue.into_iter().map(f64::from).collect(),
        source: source.to_string(),
    }
}

fn fill_from_exif(details: &mut PhotoDetails, exif: &Exif, file_bytes: &[u8]) {
    details.camera_make = ascii_field(exif, Tag::Make);
    details.camera_model = ascii_field(exif, Tag::Model);
    details.aperture = rational_field(exif, Tag::FNumber).and_then(format_aperture);
    details.shutter = rational_field(exif, Tag::ExposureTime).and_then(format_shutter);
    details.iso = uint_field(exif, Tag::PhotographicSensitivity)
        .or_else(|| uint_field(exif, Tag::ISOSpeed))
        .and_then(format_iso);
    details.exposure_compensation =
        rational_field(exif, Tag::ExposureBiasValue).and_then(format_ev);
    details.exposure_mode = uint_field(exif, Tag::ExposureProgram)
        .and_then(|value| exposure_mode_key(value, false).map(str::to_string));
    details.metering_mode = uint_field(exif, Tag::MeteringMode)
        .and_then(metering_mode_key)
        .map(str::to_string);
    details.focal_length = rational_field(exif, Tag::FocalLength).and_then(format_focal_mm);
    let equiv = uint_field(exif, Tag::FocalLengthIn35mmFilm);
    details.focal_length_35mm = equiv.and_then(format_focal_35mm);
    details.taken_at = datetime_field(exif, Tag::DateTimeOriginal);
    let interop = ascii_any(exif, Tag::InteroperabilityIndex);
    details.color_space =
        color_space_key(uint_field(exif, Tag::ColorSpace), interop.as_deref()).map(str::to_string);
    details.width = uint_field(exif, Tag::PixelXDimension)
        .or_else(|| uint_field(exif, Tag::ImageWidth))
        .map(f64::from);
    details.height = uint_field(exif, Tag::PixelYDimension)
        .or_else(|| uint_field(exif, Tag::ImageLength))
        .map(f64::from);
    details.lens = ascii_field(exif, Tag::LensModel).or_else(|| infer_lens(details, exif));
    details.gps = gps_field(exif);
    if let Some(notes) = makernote_notes(exif, details.camera_model.as_deref(), equiv, file_bytes) {
        if let Some(mode) = notes
            .exposure_program
            .and_then(|value| exposure_mode_key(value, true))
        {
            details.exposure_mode = Some(mode.to_string());
        }
        if notes.white_balance.is_some() {
            details.white_balance = notes.white_balance.map(str::to_string);
        }
        details.image_control = notes.image_control.map(str::to_string);
        details.focus_mode = notes.focus_mode.map(str::to_string);
        details.full_press_snap = notes.full_press_snap.map(str::to_string);
        details.crop_mode = notes.crop_mode.map(str::to_string);
        details.nd_filter = notes.nd_filter.map(str::to_string);
        if let Some(kelvin) = notes.color_temperature {
            details.color_temperature = format_kelvin(kelvin);
        }
    }
    if details.crop_mode.is_none() && is_gr_iiix(details.camera_model.as_deref()) {
        details.crop_mode = iiix_crop_from_35mm(equiv).map(str::to_string);
    }
    if details.white_balance.is_none() {
        details.white_balance = uint_field(exif, Tag::WhiteBalance).and_then(|value| match value {
            0 => Some("auto".to_string()),
            1 => Some("manual".to_string()),
            _ => None,
        });
    }
}

fn infer_lens(details: &PhotoDetails, exif: &Exif) -> Option<String> {
    let focal = details.focal_length.clone()?;
    let max = rational_field(exif, Tag::MaxApertureValue).and_then(apex_to_fnumber);
    if let Some(aperture) = max.and_then(format_aperture) {
        Some(format!("{focal} {aperture}"))
    } else {
        Some(focal)
    }
}

fn apex_to_fnumber(apex: f64) -> Option<f64> {
    if !apex.is_finite() {
        return None;
    }
    let value = 2f64.powf(apex / 2.0);
    if value.is_finite() && value > 0.0 {
        Some(value)
    } else {
        None
    }
}

fn makernote_notes(
    exif: &Exif,
    model: Option<&str>,
    equiv_35mm: Option<u32>,
    file_bytes: &[u8],
) -> Option<makernote::RicohNotes> {
    let from_exif = field(exif, Tag::MakerNote).and_then(|field| match &field.value {
        Value::Undefined(bytes, _) | Value::Byte(bytes) => Some(bytes.as_slice()),
        _ => None,
    });
    let bytes = from_exif.or_else(|| makernote::dng_private_data(file_bytes))?;
    makernote::parse(bytes, exif.little_endian(), model, equiv_35mm)
}

fn field(exif: &Exif, tag: Tag) -> Option<&Field> {
    exif.get_field(tag, In::PRIMARY)
        .or_else(|| exif.fields().find(|item| item.tag == tag))
}

fn ascii_field(exif: &Exif, tag: Tag) -> Option<String> {
    ascii_value(&field(exif, tag)?.value)
}

fn ascii_any(exif: &Exif, tag: Tag) -> Option<String> {
    exif.fields()
        .find(|item| item.tag == tag)
        .and_then(|item| ascii_value(&item.value))
}

fn ascii_value(value: &Value) -> Option<String> {
    match value {
        Value::Ascii(items) => items
            .first()
            .map(|bytes| {
                String::from_utf8_lossy(bytes)
                    .trim()
                    .trim_end_matches('\0')
                    .to_string()
            })
            .filter(|text| !text.is_empty()),
        _ => None,
    }
}

fn uint_field(exif: &Exif, tag: Tag) -> Option<u32> {
    field(exif, tag)?.value.get_uint(0)
}

fn rational_field(exif: &Exif, tag: Tag) -> Option<f64> {
    match &field(exif, tag)?.value {
        Value::Rational(values) => values.first().map(|value| value.to_f64()),
        Value::SRational(values) => values.first().map(|value| value.to_f64()),
        _ => None,
    }
}

fn datetime_field(exif: &Exif, tag: Tag) -> Option<String> {
    let value = match &field(exif, tag)?.value {
        Value::Ascii(items) => items.first()?,
        _ => return None,
    };
    let parsed = DateTime::from_ascii(value).ok()?;
    format_taken_at(
        u32::from(parsed.year),
        u32::from(parsed.month),
        u32::from(parsed.day),
        u32::from(parsed.hour),
        u32::from(parsed.minute),
        u32::from(parsed.second),
    )
}

fn gps_field(exif: &Exif) -> Option<String> {
    let lat = gps_rationals(exif, Tag::GPSLatitude)?;
    let lon = gps_rationals(exif, Tag::GPSLongitude)?;
    let lat_ref = ascii_field(exif, Tag::GPSLatitudeRef).unwrap_or_else(|| "N".to_string());
    let lon_ref = ascii_field(exif, Tag::GPSLongitudeRef).unwrap_or_else(|| "E".to_string());
    let lat_deg = dms_to_degrees(&lat)?;
    let lon_deg = dms_to_degrees(&lon)?;
    format_gps(lat_deg, &lat_ref, lon_deg, &lon_ref)
}

fn gps_rationals(exif: &Exif, tag: Tag) -> Option<Vec<f64>> {
    match &field(exif, tag)?.value {
        Value::Rational(values) if values.len() >= 3 => {
            Some(values.iter().take(3).map(|value| value.to_f64()).collect())
        }
        _ => None,
    }
}

/// True when `path` resolves inside `library` after canonicalization.
/// Look up a cached embedded preview without reading the DNG body.
pub fn cached_preview_file(path: &Path, cache_dir: &Path) -> Option<PathBuf> {
    preview::cached_for_file(path, cache_dir)
}

/// Load a cached or newly extracted embedded JPEG preview for a library DNG.
///
/// The original photograph is only read. Paths outside `library` are rejected.
pub fn load_library_preview(
    library: &Path,
    path: &Path,
    cache_dir: &Path,
) -> Result<Option<PathBuf>, AppError> {
    if !is_inside_library(library, path) {
        return Err(AppError::msg("找不到这张照片。"));
    }
    preview::load_cached_jpeg(path, cache_dir)
}

pub fn is_inside_library(library: &Path, path: &Path) -> bool {
    let Ok(root) = library.canonicalize() else {
        return false;
    };
    let Ok(file) = path.canonicalize() else {
        return false;
    };
    file.starts_with(&root)
}

#[cfg(test)]
mod tests {
    use super::{inspect_photo, load_library_preview};
    use crate::metadata::makernote::{IfdValue, test_payload, test_payload_ricoh_pentax};
    use crate::metadata::preview::test_dng_with_preview;
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
            "ricoh-mac-meta-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn solid_jpeg(r: u8, g: u8, b: u8, width: u32, height: u32) -> Vec<u8> {
        let mut image = RgbImage::new(width, height);
        for pixel in image.pixels_mut() {
            *pixel = Rgb([r, g, b]);
        }
        let mut cursor = Cursor::new(Vec::new());
        image.write_to(&mut cursor, ImageFormat::Jpeg).unwrap();
        cursor.into_inner()
    }

    fn snapshot(path: &std::path::Path) -> (u64, Vec<u8>) {
        (fs::metadata(path).unwrap().len(), fs::read(path).unwrap())
    }

    /// Very small Exif APP1 writer for tests.
    fn jpeg_with_exif(jpeg: &[u8], tiff: &[u8]) -> Vec<u8> {
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
        let payload_len = 2 + 6 + tiff.len();
        let mut out = Vec::with_capacity(jpeg.len() + payload_len + 4);
        out.extend_from_slice(&[0xFF, 0xD8, 0xFF, 0xE1]);
        out.extend_from_slice(&(payload_len as u16).to_be_bytes());
        out.extend_from_slice(b"Exif\0\0");
        out.extend_from_slice(tiff);
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    fn ascii_entry(tag: u16, offset: u32, bytes: &[u8]) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&2u16.to_le_bytes());
        entry.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        if bytes.len() <= 4 {
            let mut value = [0u8; 4];
            value[..bytes.len()].copy_from_slice(bytes);
            entry.extend_from_slice(&value);
        } else {
            entry.extend_from_slice(&offset.to_le_bytes());
        }
        entry
    }

    fn short_entry(tag: u16, value: u16) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&3u16.to_le_bytes());
        entry.extend_from_slice(&1u32.to_le_bytes());
        entry.extend_from_slice(&u32::from(value).to_le_bytes());
        entry
    }

    fn long_entry(tag: u16, value: u32) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&4u16.to_le_bytes());
        entry.extend_from_slice(&1u32.to_le_bytes());
        entry.extend_from_slice(&value.to_le_bytes());
        entry
    }

    fn rational_entry(tag: u16, typ: u16, offset: u32) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&typ.to_le_bytes());
        entry.extend_from_slice(&1u32.to_le_bytes());
        entry.extend_from_slice(&offset.to_le_bytes());
        entry
    }

    fn undefined_entry(tag: u16, offset: u32, len: u32) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&7u16.to_le_bytes());
        entry.extend_from_slice(&len.to_le_bytes());
        entry.extend_from_slice(&offset.to_le_bytes());
        entry
    }

    fn encode_rational(num: u32, den: u32) -> [u8; 8] {
        let mut out = [0u8; 8];
        out[..4].copy_from_slice(&num.to_le_bytes());
        out[4..].copy_from_slice(&den.to_le_bytes());
        out
    }

    fn encode_srational(num: i32, den: i32) -> [u8; 8] {
        let mut out = [0u8; 8];
        out[..4].copy_from_slice(&num.to_le_bytes());
        out[4..].copy_from_slice(&den.to_le_bytes());
        out
    }

    fn sample_exif_tiff(model: &str, maker_note: &[u8], with_gps: bool) -> Vec<u8> {
        sample_exif_container(model, maker_note, &[], 71, with_gps)
    }

    fn sample_exif_container(
        model: &str,
        maker_note: &[u8],
        dng_private: &[u8],
        equiv_35mm: u16,
        with_gps: bool,
    ) -> Vec<u8> {
        // Layout is assembled in two passes so offsets are known.
        let make = b"RICOH\0";
        let model_bytes = {
            let mut bytes = model.as_bytes().to_vec();
            if !bytes.ends_with(&[0]) {
                bytes.push(0);
            }
            bytes
        };
        let datetime = b"2026:11:15 20:30:00\0";
        let lat_ref = b"N\0";
        let lon_ref = b"E\0";

        // We'll put IFD0 at 8, then data blocks, then Exif IFD, then GPS IFD.
        // Use a simpler approach: collect extra blobs and write entries with
        // a running offset after the IFDs.
        let ifd0_tags_without_gps = 3u16 + if dng_private.is_empty() { 0 } else { 1 }; // Make, Model, ExifIFD, optional DNGPrivateData
        let ifd0_count = if with_gps {
            ifd0_tags_without_gps + 1
        } else {
            ifd0_tags_without_gps
        };
        let ifd0_start = 8u32;
        let ifd0_size = 2 + u32::from(ifd0_count) * 12 + 4;
        let mut offset = ifd0_start + ifd0_size;

        let make_off = offset;
        offset += make.len() as u32;
        let model_off = offset;
        offset += model_bytes.len() as u32;

        // Exif IFD
        let exif_count = 12u16 + if !maker_note.is_empty() { 1 } else { 0 };
        let exif_start = offset;
        let exif_size = 2 + u32::from(exif_count) * 12 + 4;
        offset += exif_size;

        let dt_off = offset;
        offset += datetime.len() as u32;
        let fnumber_off = offset;
        offset += 8;
        let shutter_off = offset;
        offset += 8;
        let ev_off = offset;
        offset += 8;
        let focal_off = offset;
        offset += 8;
        let note_off = offset;
        if !maker_note.is_empty() {
            offset += maker_note.len() as u32;
        }
        let private_off = offset;
        if !dng_private.is_empty() {
            offset += dng_private.len() as u32;
        }

        let (gps_start, lat_off, lon_off, lat_ref_off, lon_ref_off, end_after_gps) = if with_gps {
            let gps_count = 4u16;
            let start = offset;
            let size = 2 + u32::from(gps_count) * 12 + 4;
            offset += size;
            let lat_ref_off = offset;
            offset += lat_ref.len() as u32;
            let lon_ref_off = offset;
            offset += lon_ref.len() as u32;
            let lat_off = offset;
            offset += 24;
            let lon_off = offset;
            offset += 24;
            (
                Some(start),
                Some(lat_off),
                Some(lon_off),
                Some(lat_ref_off),
                Some(lon_ref_off),
                offset,
            )
        } else {
            (None, None, None, None, None, offset)
        };
        let _ = end_after_gps;

        let mut tiff = vec![b'I', b'I', 42, 0];
        tiff.extend_from_slice(&ifd0_start.to_le_bytes());
        debug_assert_eq!(tiff.len(), 8);
        tiff.extend_from_slice(&ifd0_count.to_le_bytes());
        tiff.extend(ascii_entry(0x010F, make_off, make));
        tiff.extend(ascii_entry(0x0110, model_off, &model_bytes));
        tiff.extend(long_entry(0x8769, exif_start));
        if !dng_private.is_empty() {
            tiff.extend(undefined_entry(
                0xC634,
                private_off,
                dng_private.len() as u32,
            ));
        }
        if let Some(start) = gps_start {
            tiff.extend(long_entry(0x8825, start));
        }
        tiff.extend_from_slice(&0u32.to_le_bytes());
        tiff.extend_from_slice(make);
        tiff.extend_from_slice(&model_bytes);
        debug_assert_eq!(tiff.len() as u32, exif_start);

        tiff.extend_from_slice(&exif_count.to_le_bytes());
        tiff.extend(rational_entry(0x829A, 5, shutter_off)); // ExposureTime
        tiff.extend(rational_entry(0x829D, 5, fnumber_off)); // FNumber
        tiff.extend(short_entry(0x8822, 3)); // ExposureProgram aperture
        tiff.extend(short_entry(0x8827, 400)); // PhotographicSensitivity
        tiff.extend(ascii_entry(0x9003, dt_off, datetime));
        tiff.extend(rational_entry(0x9204, 10, ev_off)); // ExposureBias
        tiff.extend(short_entry(0x9207, 5)); // Metering pattern
        tiff.extend(rational_entry(0x920A, 5, focal_off)); // FocalLength
        if !maker_note.is_empty() {
            tiff.extend(undefined_entry(0x927C, note_off, maker_note.len() as u32));
        }
        tiff.extend(short_entry(0xA001, 1)); // sRGB
        tiff.extend(long_entry(0xA002, 6000));
        tiff.extend(long_entry(0xA003, 4000));
        tiff.extend(short_entry(0xA405, equiv_35mm)); // 35mm equiv
        tiff.extend_from_slice(&0u32.to_le_bytes());
        tiff.extend_from_slice(datetime);
        tiff.extend_from_slice(&encode_rational(28, 10)); // F2.8
        tiff.extend_from_slice(&encode_rational(1, 500));
        tiff.extend_from_slice(&encode_srational(3, 10)); // +0.3
        tiff.extend_from_slice(&encode_rational(183, 10)); // 18.3 mm
        if !maker_note.is_empty() {
            tiff.extend_from_slice(maker_note);
        }
        if !dng_private.is_empty() {
            tiff.extend_from_slice(dng_private);
        }
        if let (Some(start), Some(lat_off), Some(lon_off), Some(lat_ref_off), Some(lon_ref_off)) =
            (gps_start, lat_off, lon_off, lat_ref_off, lon_ref_off)
        {
            debug_assert_eq!(tiff.len() as u32, start);
            tiff.extend_from_slice(&4u16.to_le_bytes());
            tiff.extend(ascii_entry(0x0001, lat_ref_off, lat_ref));
            tiff.extend(undefined_as_rational(0x0002, lat_off, 3));
            tiff.extend(ascii_entry(0x0003, lon_ref_off, lon_ref));
            tiff.extend(undefined_as_rational(0x0004, lon_off, 3));
            tiff.extend_from_slice(&0u32.to_le_bytes());
            tiff.extend_from_slice(lat_ref);
            tiff.extend_from_slice(lon_ref);
            // 31, 12, 0 and 121, 28, 0
            for (num, den) in [(31u32, 1u32), (12, 1), (0, 1), (121, 1), (28, 1), (0, 1)] {
                tiff.extend_from_slice(&encode_rational(num, den));
            }
        }
        tiff
    }

    fn undefined_as_rational(tag: u16, offset: u32, count: u32) -> Vec<u8> {
        let mut entry = Vec::new();
        entry.extend_from_slice(&tag.to_le_bytes());
        entry.extend_from_slice(&5u16.to_le_bytes());
        entry.extend_from_slice(&count.to_le_bytes());
        entry.extend_from_slice(&offset.to_le_bytes());
        entry
    }

    #[test]
    fn reads_standard_exif_and_ricoh_notes_from_a_jpeg() {
        let jpeg = solid_jpeg(20, 40, 80, 16, 16);
        let notes = test_payload(&[
            (0x1006, 4),
            (0x100D, 1),
            (0x1010, 11),
            (0x1018, 2),
            (0x1019, 1),
        ]);
        let tiff = sample_exif_tiff("RICOH GR IIIx", &notes, true);
        let file = jpeg_with_exif(&jpeg, &tiff);
        let dir = unique_dir("jpeg");
        let path = dir.join("R0000001.JPG");
        fs::write(&path, &file).unwrap();
        let before = snapshot(&path);
        let details = inspect_photo(&path, Some(&dir.join("cache"))).unwrap();
        assert_eq!(snapshot(&path), before);
        assert_eq!(details.format, "jpeg");
        assert_eq!(details.camera_model.as_deref(), Some("RICOH GR IIIx"));
        assert_eq!(details.aperture.as_deref(), Some("F2.8"));
        assert_eq!(details.shutter.as_deref(), Some("1/500"));
        assert_eq!(details.iso.as_deref(), Some("400"));
        assert_eq!(details.exposure_compensation.as_deref(), Some("+0.3"));
        assert_eq!(details.focal_length.as_deref(), Some("18.3 mm"));
        assert_eq!(details.focal_length_35mm.as_deref(), Some("71 mm"));
        assert_eq!(details.crop_mode.as_deref(), Some("crop_71"));
        assert_ne!(details.crop_mode.as_deref(), Some("crop_47"));
        assert_eq!(details.image_control.as_deref(), Some("positive_film"));
        assert_eq!(details.focus_mode.as_deref(), Some("snap"));
        assert_eq!(details.full_press_snap.as_deref(), Some("on"));
        assert_eq!(details.nd_filter.as_deref(), Some("on"));
        assert_eq!(details.color_space.as_deref(), Some("srgb"));
        assert_eq!(details.aspect_ratio.as_deref(), Some("3:2"));
        assert_eq!(details.taken_at.as_deref(), Some("2026-11-15 20:30:00"));
        assert!(
            details
                .gps
                .as_deref()
                .is_some_and(|value| value.contains("31") && value.contains("121"))
        );
        assert_eq!(details.preview_source.as_deref(), Some("original"));
        assert!(details.histogram.is_some());
        assert_eq!(details.histogram.as_ref().unwrap().source, "original");
    }

    fn compact_pentax_notes() -> Vec<u8> {
        test_payload_ricoh_pentax(&[
            IfdValue::Short(0x000D, 6),
            IfdValue::Short(0x0019, 14),
            IfdValue::Short(0x004F, 258),
            IfdValue::Short(0x0050, 0),
            IfdValue::Bytes(0x0088, 0, 2),
        ])
    }

    #[test]
    fn reads_compact_pentax_notes_from_a_jpeg() {
        let jpeg = solid_jpeg(20, 40, 80, 16, 16);
        let tiff = sample_exif_container("RICOH GR IIIx", &compact_pentax_notes(), &[], 40, false);
        let file = jpeg_with_exif(&jpeg, &tiff);
        let dir = unique_dir("jpeg-pentax");
        let path = dir.join("R0001005.JPG");
        fs::write(&path, &file).unwrap();
        let before = snapshot(&path);
        let details = inspect_photo(&path, None).unwrap();
        assert_eq!(snapshot(&path), before);
        assert_eq!(details.camera_model.as_deref(), Some("RICOH GR IIIx"));
        assert_eq!(details.image_control.as_deref(), Some("monotone"));
        assert_eq!(details.focus_mode.as_deref(), Some("auto_area"));
        assert_eq!(details.white_balance.as_deref(), Some("multi_auto"));
        assert_eq!(details.nd_filter.as_deref(), Some("off"));
        assert_eq!(details.full_press_snap, None);
        assert_eq!(details.color_temperature, None);
        assert_eq!(details.crop_mode.as_deref(), Some("off"));
        assert_eq!(details.focal_length_35mm.as_deref(), Some("40 mm"));
    }

    #[test]
    fn reads_compact_pentax_notes_from_dng_private_data() {
        let tiff = sample_exif_container("RICOH GR IIIx", &[], &compact_pentax_notes(), 40, false);
        let dir = unique_dir("dng-private");
        let path = dir.join("R0001005.DNG");
        fs::write(&path, &tiff).unwrap();
        let before = snapshot(&path);
        let details = inspect_photo(&path, Some(&dir.join("cache"))).unwrap();
        assert_eq!(snapshot(&path), before);
        assert_eq!(details.format, "dng");
        assert_eq!(details.camera_model.as_deref(), Some("RICOH GR IIIx"));
        assert_eq!(details.image_control.as_deref(), Some("monotone"));
        assert_eq!(details.focus_mode.as_deref(), Some("auto_area"));
        assert_eq!(details.white_balance.as_deref(), Some("multi_auto"));
        assert_eq!(details.nd_filter.as_deref(), Some("off"));
        assert_eq!(details.full_press_snap, None);
        assert_eq!(details.crop_mode.as_deref(), Some("off"));
    }

    #[test]
    fn extracts_a_dng_preview_without_writing_the_original() {
        let jpeg = solid_jpeg(200, 10, 10, 8, 8);
        let dng = test_dng_with_preview(&jpeg, 8, 8);
        let dir = unique_dir("dng");
        let path = dir.join("R0000002.DNG");
        fs::write(&path, &dng).unwrap();
        let before = snapshot(&path);
        let cache = dir.join("cache");
        let details = inspect_photo(&path, Some(&cache)).unwrap();
        assert_eq!(snapshot(&path), before);
        assert_eq!(details.format, "dng");
        assert_eq!(details.preview_source.as_deref(), Some("preview"));
        assert!(details.preview_url.is_some());
        assert_eq!(details.histogram.as_ref().unwrap().source, "preview");
        assert!(cache.read_dir().unwrap().any(|entry| {
            entry
                .unwrap()
                .path()
                .extension()
                .and_then(|ext| ext.to_str())
                == Some("jpg")
        }));
    }

    #[test]
    fn inspect_rejects_a_missing_file() {
        let err = inspect_photo(&unique_dir("missing").join("nope.jpg"), None)
            .unwrap_err()
            .to_string();
        assert!(
            err.contains("无法读取这张照片") || err.contains("找不到"),
            "{err}"
        );
    }

    #[test]
    fn load_library_preview_rejects_a_path_outside_the_library() {
        let library = unique_dir("library");
        let outside = unique_dir("outside");
        let path = outside.join("R0000002.DNG");
        fs::write(&path, b"dng").unwrap();
        let err = load_library_preview(&library, &path, &library.join("cache"))
            .unwrap_err()
            .to_string();
        assert!(err.contains("找不到这张照片"), "{err}");
        assert_eq!(fs::read(&path).unwrap(), b"dng");
    }

    #[test]
    fn load_library_preview_extracts_inside_the_library() {
        let jpeg = solid_jpeg(200, 10, 10, 8, 8);
        let dng = test_dng_with_preview(&jpeg, 8, 8);
        let library = unique_dir("library-preview");
        let path = library.join("R0000002.DNG");
        fs::write(&path, &dng).unwrap();
        let before = snapshot(&path);
        let cache = library.join("cache");
        let cached = load_library_preview(&library, &path, &cache)
            .unwrap()
            .expect("preview");
        assert_eq!(snapshot(&path), before);
        assert_eq!(fs::read(&cached).unwrap(), jpeg);
        assert!(cached.starts_with(&cache));
    }

    #[test]
    fn public_gr_iiix_samples_match_verified_facts_when_present() {
        let dir = PathBuf::from(std::env::var_os("HOME").unwrap_or_default())
            .join("Library/Caches/ricoh-mac/gr-iiix-samples");
        let cases: [(&str, u64, &str, &str, &str, &str); 3] = [
            (
                "pixls-us/Ricoh - GR IIIx - 14bit (3:2).DNG",
                31_357_843,
                "monotone",
                "auto_area",
                "multi_auto",
                "off",
            ),
            (
                "imaging-resource/GR3xhSLI000100NR0.DNG",
                34_280_956,
                "standard",
                "manual",
                "manual",
                "off",
            ),
            (
                "imaging-resource/Y-WB-GRIIIx-R0000001.JPG",
                14_288_082,
                "standard",
                "select",
                "multi_auto",
                "off",
            ),
        ];
        for (rel, size, image, focus, wb, nd) in cases {
            let path = dir.join(rel);
            if !path.is_file() {
                continue;
            }
            if fs::metadata(&path).map(|info| info.len()).ok() != Some(size) {
                continue;
            }
            let details = inspect_photo(&path, Some(&dir.join("inspect-cache"))).unwrap();
            assert_eq!(details.camera_model.as_deref(), Some("RICOH GR IIIx"));
            assert_eq!(details.focal_length_35mm.as_deref(), Some("40 mm"));
            assert_eq!(details.crop_mode.as_deref(), Some("off"));
            assert_eq!(details.image_control.as_deref(), Some(image), "{rel}");
            assert_eq!(details.focus_mode.as_deref(), Some(focus), "{rel}");
            assert_eq!(details.white_balance.as_deref(), Some(wb), "{rel}");
            assert_eq!(details.nd_filter.as_deref(), Some(nd), "{rel}");
            assert_eq!(details.full_press_snap, None, "{rel}");
            assert_eq!(details.color_temperature, None, "{rel}");
        }
    }
}
