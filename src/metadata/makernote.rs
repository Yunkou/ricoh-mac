//! A small, read-only parser for GR III / GR IIIx photographer-panel fields.
//!
//! Real GR IIIx JPEG and DNG files store these values in a Pentax-layout
//! MakerNote (`RICOH\0` + endian marker + IFD count, no TIFF magic 42). The
//! older Ricoh tag IDs (0x10xx) are still recognized for synthetic fixtures
//! and any file that uses that layout. The parser does not read serial
//! numbers, GPS, or other personal fields.

use super::format::{
    crop_mode_key, focus_mode_key, image_control_key, on_off_key, pentax_focus_mode_key,
    pentax_image_tone_key, pentax_white_balance_key, ricoh_white_balance_key,
};
use super::tiff::{Endian, read_ifd, tiff_header, u16_at, u32_at, walk_ifds};

const TAG_EXPOSURE_PROGRAM: u16 = 0x1001;
const TAG_WHITE_BALANCE: u16 = 0x1003;
const TAG_FOCUS_MODE: u16 = 0x1006;
const TAG_FULL_PRESS_SNAP: u16 = 0x100D;
const TAG_IMAGE_EFFECTS: u16 = 0x1010;
const TAG_CROP_MODE: u16 = 0x1018;
const TAG_ND_FILTER: u16 = 0x1019;
const TAG_COLOR_TEMP_KELVIN: u16 = 0x1307;

/// Pentax-layout tags used by real GR IIIx JPEG and DNG MakerNotes.
/// IDs and enumerations follow ExifTool's public Pentax tag documentation.
const PENTAX_TAG_FOCUS_MODE: u16 = 0x000D;
const PENTAX_TAG_WHITE_BALANCE: u16 = 0x0019;
const PENTAX_TAG_IMAGE_TONE: u16 = 0x004F;
const PENTAX_TAG_COLOR_TEMPERATURE: u16 = 0x0050;
const PENTAX_TAG_ND_FILTER: u16 = 0x0088;

const TAG_DNG_PRIVATE_DATA: u16 = 0xC634;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RicohNotes {
    pub exposure_program: Option<u32>,
    pub white_balance: Option<&'static str>,
    pub focus_mode: Option<&'static str>,
    pub full_press_snap: Option<&'static str>,
    pub image_control: Option<&'static str>,
    pub crop_mode: Option<&'static str>,
    pub nd_filter: Option<&'static str>,
    pub color_temperature: Option<u32>,
}

pub fn parse(
    bytes: &[u8],
    exif_little_endian: bool,
    model: Option<&str>,
    equiv_35mm: Option<u32>,
) -> Option<RicohNotes> {
    let (data, ifd_offset, endian) = locate_ifd(bytes, exif_little_endian)?;
    let (entries, _next) = read_ifd(data, ifd_offset, endian)?;
    let mut notes = RicohNotes::default();
    for (entry, offset) in entries {
        let value = match entry.first_u32_from(data, offset, endian) {
            Some(value) => value,
            None => continue,
        };
        match entry.tag {
            TAG_EXPOSURE_PROGRAM => notes.exposure_program = Some(value),
            TAG_WHITE_BALANCE => notes.white_balance = ricoh_white_balance_key(value as u16),
            TAG_FOCUS_MODE => notes.focus_mode = focus_mode_key(value as u16),
            TAG_FULL_PRESS_SNAP => notes.full_press_snap = on_off_key(value as u16),
            TAG_IMAGE_EFFECTS => notes.image_control = image_control_key(value as u16),
            TAG_CROP_MODE => notes.crop_mode = crop_mode_key(model, value as u16, equiv_35mm),
            TAG_ND_FILTER => notes.nd_filter = on_off_key(value as u16),
            TAG_COLOR_TEMP_KELVIN | PENTAX_TAG_COLOR_TEMPERATURE
                if (1000..=20_000).contains(&value) =>
            {
                notes.color_temperature = Some(value);
            }
            PENTAX_TAG_FOCUS_MODE => notes.focus_mode = pentax_focus_mode_key(value as u16),
            PENTAX_TAG_WHITE_BALANCE => {
                notes.white_balance = pentax_white_balance_key(value as u16)
            }
            PENTAX_TAG_IMAGE_TONE => notes.image_control = pentax_image_tone_key(value as u16),
            PENTAX_TAG_ND_FILTER => notes.nd_filter = on_off_key(value as u16),
            _ => {}
        }
    }
    Some(notes)
}

/// Reads DNG tag 0xC634 (`DNGPrivateData`), where GR IIIx DNG files store
/// MakerNotes. kamadak-exif does not expose this tag.
pub fn dng_private_data(file_bytes: &[u8]) -> Option<&[u8]> {
    let (endian, ifd0) = tiff_header(file_bytes)?;
    for (_offset, entries) in walk_ifds(file_bytes, ifd0, endian) {
        for (entry, entry_offset) in entries {
            if entry.tag != TAG_DNG_PRIVATE_DATA {
                continue;
            }
            let len = entry.byte_len()? as usize;
            if len == 0 {
                return None;
            }
            let start = if len <= 4 {
                entry_offset.checked_add(8)?
            } else {
                entry.value_or_offset as usize
            };
            return file_bytes.get(start..start.checked_add(len)?);
        }
    }
    None
}

fn locate_ifd(bytes: &[u8], exif_little_endian: bool) -> Option<(&[u8], usize, Endian)> {
    let mut start = 0usize;
    if let Some(rest) = skip_ricoh_prefix(bytes) {
        start = rest;
    }
    let rest = bytes.get(start..)?;
    if let Some(endian) = Endian::from_header(rest) {
        let after_endian = u16_at(rest, 2, endian)?;
        if after_endian == 42 {
            let ifd = u32_at(rest, 4, endian)? as usize;
            if ifd >= rest.len() {
                return None;
            }
            return Some((rest, ifd, endian));
        }
        // Real GR IIIx notes use `RICOH\0` + `II`/`MM` + the IFD entry count.
        // There is no TIFF magic 42 and no 4-byte IFD offset.
        if compact_ifd_header(rest, after_endian) {
            return Some((rest, 2, endian));
        }
    }
    let endian = if exif_little_endian {
        Endian::LITTLE
    } else {
        Endian::BIG
    };
    if rest.len() >= 14 {
        Some((rest, 0, endian))
    } else {
        None
    }
}

fn compact_ifd_header(rest: &[u8], count: u16) -> bool {
    if count == 0 || count as usize > 256 {
        return false;
    }
    let Some(needed) = 12usize
        .checked_mul(count as usize)
        .and_then(|entries| 2usize.checked_add(entries))
        .and_then(|value| value.checked_add(4))
    else {
        return false;
    };
    rest.len() >= needed
}

fn skip_ricoh_prefix(bytes: &[u8]) -> Option<usize> {
    const PREFIXES: [&[u8]; 3] = [b"Ricoh", b"RICOH", b"ricoh"];
    for prefix in PREFIXES {
        if bytes.starts_with(prefix) {
            let mut index = prefix.len();
            while index < bytes.len() && index < prefix.len() + 8 && bytes[index] == 0 {
                index += 1;
            }
            return Some(index);
        }
    }
    None
}

/// Builds a Ricoh MakerNote payload (`Ricoh\0\0\0` + little-endian TIFF IFD).
#[cfg(test)]
pub fn test_payload(tags: &[(u16, u16)]) -> Vec<u8> {
    let mut payload = b"Ricoh\0\0\0".to_vec();
    let tiff_start = payload.len();
    payload.extend_from_slice(b"II");
    payload.extend_from_slice(&42u16.to_le_bytes());
    payload.extend_from_slice(&8u32.to_le_bytes());
    payload.extend_from_slice(&(tags.len() as u16).to_le_bytes());
    for (tag, value) in tags {
        payload.extend_from_slice(&tag.to_le_bytes());
        payload.extend_from_slice(&3u16.to_le_bytes());
        payload.extend_from_slice(&1u32.to_le_bytes());
        payload.extend_from_slice(&u32::from(*value).to_le_bytes());
    }
    payload.extend_from_slice(&0u32.to_le_bytes());
    debug_assert!(payload.len() > tiff_start + 8);
    payload
}

/// Builds a compact `RICOH\0` + `II` + IFD payload, as used by real GR IIIx files.
#[cfg(test)]
pub fn test_payload_ricoh_pentax(entries: &[IfdValue]) -> Vec<u8> {
    let mut payload = b"RICOH\0II".to_vec();
    payload.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    for entry in entries {
        payload.extend_from_slice(&entry.bytes());
    }
    payload.extend_from_slice(&0u32.to_le_bytes());
    payload
}

#[cfg(test)]
#[derive(Clone, Copy)]
pub enum IfdValue {
    Short(u16, u16),
    Bytes(u16, u8, u8),
}

#[cfg(test)]
impl IfdValue {
    fn bytes(self) -> [u8; 12] {
        let mut out = [0u8; 12];
        match self {
            Self::Short(tag, value) => {
                out[0..2].copy_from_slice(&tag.to_le_bytes());
                out[2..4].copy_from_slice(&3u16.to_le_bytes());
                out[4..8].copy_from_slice(&1u32.to_le_bytes());
                out[8..10].copy_from_slice(&value.to_le_bytes());
            }
            Self::Bytes(tag, a, b) => {
                out[0..2].copy_from_slice(&tag.to_le_bytes());
                out[2..4].copy_from_slice(&1u16.to_le_bytes());
                out[4..8].copy_from_slice(&2u32.to_le_bytes());
                out[8] = a;
                out[9] = b;
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_iiix_crop_snap_and_image_control() {
        let payload = test_payload(&[
            (TAG_FOCUS_MODE, 4),
            (TAG_FULL_PRESS_SNAP, 1),
            (TAG_IMAGE_EFFECTS, 11),
            (TAG_CROP_MODE, 2),
            (TAG_ND_FILTER, 1),
            (TAG_WHITE_BALANCE, 11),
            (TAG_COLOR_TEMP_KELVIN, 5200),
            (TAG_EXPOSURE_PROGRAM, 3),
        ]);
        let notes = parse(&payload, true, Some("RICOH GR IIIx"), Some(71)).expect("notes");
        assert_eq!(notes.focus_mode, Some("snap"));
        assert_eq!(notes.full_press_snap, Some("on"));
        assert_eq!(notes.image_control, Some("positive_film"));
        assert_eq!(notes.crop_mode, Some("crop_71"));
        assert_eq!(notes.nd_filter, Some("on"));
        assert_eq!(notes.white_balance, Some("kelvin"));
        assert_eq!(notes.color_temperature, Some(5200));
        assert_eq!(notes.exposure_program, Some(3));
    }

    #[test]
    fn reads_real_iiix_compact_pentax_layout() {
        // Values observed on public GR IIIx samples, using ExifTool's Pentax
        // enumerations: ImageTone 258 = Monotone, FocusMode 6 = Auto-area,
        // WhiteBalance 14 = Multi Auto, NeutralDensityFilter 0 2 = Off (Auto).
        let payload = test_payload_ricoh_pentax(&[
            IfdValue::Short(PENTAX_TAG_FOCUS_MODE, 6),
            IfdValue::Short(PENTAX_TAG_WHITE_BALANCE, 14),
            IfdValue::Short(PENTAX_TAG_IMAGE_TONE, 258),
            IfdValue::Short(PENTAX_TAG_COLOR_TEMPERATURE, 0),
            IfdValue::Bytes(PENTAX_TAG_ND_FILTER, 0, 2),
        ]);
        let notes = parse(&payload, true, Some("RICOH GR IIIx"), Some(40)).expect("notes");
        assert_eq!(notes.focus_mode, Some("auto_area"));
        assert_eq!(notes.white_balance, Some("multi_auto"));
        assert_eq!(notes.image_control, Some("monotone"));
        assert_eq!(notes.nd_filter, Some("off"));
        assert_eq!(notes.color_temperature, None);
        assert_eq!(notes.full_press_snap, None);
        assert_eq!(notes.crop_mode, None);
    }

    #[test]
    fn compact_layout_reads_manual_standard_and_kelvin() {
        let payload = test_payload_ricoh_pentax(&[
            IfdValue::Short(PENTAX_TAG_FOCUS_MODE, 3),
            IfdValue::Short(PENTAX_TAG_WHITE_BALANCE, 17),
            IfdValue::Short(PENTAX_TAG_IMAGE_TONE, 256),
            IfdValue::Short(PENTAX_TAG_COLOR_TEMPERATURE, 5200),
            IfdValue::Bytes(PENTAX_TAG_ND_FILTER, 1, 1),
        ]);
        let notes = parse(&payload, true, Some("RICOH GR IIIx"), Some(40)).expect("notes");
        assert_eq!(notes.focus_mode, Some("manual"));
        assert_eq!(notes.white_balance, Some("kelvin"));
        assert_eq!(notes.image_control, Some("standard"));
        assert_eq!(notes.nd_filter, Some("on"));
        assert_eq!(notes.color_temperature, Some(5200));
    }

    #[test]
    fn unknown_layout_does_not_panic() {
        assert!(parse(b"not a makernote", true, None, None).is_none());
        assert!(parse(&[0, 1, 2], true, Some("GR IIIx"), Some(40)).is_none());
    }
}
