//! Read-only extraction of an embedded JPEG preview from a TIFF/DNG file.

use super::tiff::{Endian, IfdEntry, tiff_header, walk_ifds};

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
    bytes.len() >= 4 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
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
    use super::{extract_jpeg, test_dng_with_preview};
    use image::{ImageFormat, Rgb, RgbImage};
    use std::io::Cursor;

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
        let mut dng = test_dng_with_preview(&[0, 1, 2, 3, 4], 4, 4);
        // overwrite payload with non-jpeg (already not jpeg)
        assert!(extract_jpeg(&dng).is_none());
        dng[0] = 0;
        assert!(extract_jpeg(&dng).is_none());
    }
}
