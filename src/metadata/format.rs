//! Language-neutral formatting and stable keys for photographer fields.

pub fn format_aperture(value: f64) -> Option<String> {
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(format!("F{}", trim_float(value)))
}

pub fn format_shutter(seconds: f64) -> Option<String> {
    if !seconds.is_finite() || seconds <= 0.0 {
        return None;
    }
    if seconds < 0.75 {
        let denom = (1.0 / seconds).round();
        if denom >= 1.5 && (1.0 / denom - seconds).abs() / seconds < 0.08 {
            return Some(format!("1/{}", denom as u32));
        }
    }
    Some(format!("{}″", trim_float(seconds)))
}

pub fn format_iso(value: u32) -> Option<String> {
    if value == 0 {
        return None;
    }
    Some(value.to_string())
}

pub fn format_ev(value: f64) -> Option<String> {
    if !value.is_finite() {
        return None;
    }
    if value.abs() < 0.01 {
        return Some("0".to_string());
    }
    let formatted = trim_float(value.abs());
    if value > 0.0 {
        Some(format!("+{formatted}"))
    } else {
        Some(format!("-{formatted}"))
    }
}

pub fn format_focal_mm(value: f64) -> Option<String> {
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(format!("{} mm", trim_float(value)))
}

pub fn format_focal_35mm(value: u32) -> Option<String> {
    if value == 0 {
        return None;
    }
    Some(format!("{value} mm"))
}

pub fn format_kelvin(value: u32) -> Option<String> {
    if !(1000..=20_000).contains(&value) {
        return None;
    }
    Some(format!("{value} K"))
}

pub fn aspect_ratio(width: u32, height: u32) -> Option<String> {
    if width == 0 || height == 0 {
        return None;
    }
    let long = width.max(height) as f64;
    let short = width.min(height) as f64;
    let ratio = long / short;
    if (ratio - 1.0).abs() < 0.03 {
        Some("1:1".to_string())
    } else if (ratio - 1.5).abs() < 0.04 {
        Some("3:2".to_string())
    } else if (ratio - 4.0 / 3.0).abs() < 0.04 {
        Some("4:3".to_string())
    } else if (ratio - 16.0 / 9.0).abs() < 0.05 {
        Some("16:9".to_string())
    } else {
        let g = gcd(width, height);
        Some(format!("{}:{}", width / g, height / g))
    }
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let rest = a % b;
        a = b;
        b = rest;
    }
    a.max(1)
}

pub fn trim_float(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if (rounded - rounded.round()).abs() < 0.001 {
        format!("{}", rounded.round() as i64)
    } else {
        let text = format!("{rounded:.2}");
        text.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

pub fn exposure_mode_key(value: u32, ricoh: bool) -> Option<&'static str> {
    if ricoh {
        return Some(match value {
            1 => "auto",
            2 => "program",
            3 => "aperture",
            4 => "shutter",
            5 => "shutter_aperture",
            6 => "manual",
            7 => "movie",
            _ => return None,
        });
    }
    Some(match value {
        1 => "manual",
        2 => "program",
        3 => "aperture",
        4 => "shutter",
        5 => "creative",
        6 => "action",
        7 => "portrait",
        8 => "landscape",
        9 => "bulb",
        _ => return None,
    })
}

pub fn metering_mode_key(value: u32) -> Option<&'static str> {
    Some(match value {
        1 => "average",
        2 => "center",
        3 => "spot",
        4 => "multi_spot",
        5 => "pattern",
        6 => "partial",
        _ => return None,
    })
}

pub fn color_space_key(
    color_space: Option<u32>,
    interop_index: Option<&str>,
) -> Option<&'static str> {
    if interop_index.is_some_and(|index| index == "R03") {
        return Some("adobe_rgb");
    }
    match color_space {
        Some(1) => Some("srgb"),
        Some(0xFFFF) if interop_index.is_some_and(|index| index == "R03") => Some("adobe_rgb"),
        _ => None,
    }
}

/// Interpret Ricoh CropMode. Never labels a GR IIIx file as 35 mm or 47 mm.
pub fn crop_mode_key(
    model: Option<&str>,
    value: u16,
    equiv_35mm: Option<u32>,
) -> Option<&'static str> {
    match value {
        0 => Some("off"),
        1 | 2 => {
            if is_gr_iiix(model) {
                return Some(if value == 1 { "crop_50" } else { "crop_71" });
            }
            if is_gr_iii(model) {
                return Some(if value == 1 { "crop_35" } else { "crop_47" });
            }
            match equiv_35mm {
                Some(48..=55) => Some("crop_50"),
                Some(65..=80) => Some("crop_71"),
                Some(38..=44) => Some("off"),
                Some(26..=32) => Some("off"),
                _ => Some("on"),
            }
        }
        _ => None,
    }
}

pub fn is_gr_iiix(model: Option<&str>) -> bool {
    let Some(model) = model else {
        return false;
    };
    let compact: String = model
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>()
        .to_ascii_uppercase();
    compact.contains("GRIIIX")
}

pub fn is_gr_iii(model: Option<&str>) -> bool {
    let Some(model) = model else {
        return false;
    };
    let compact: String = model
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>()
        .to_ascii_uppercase();
    compact.contains("GRIII") && !compact.contains("GRIIIX")
}

pub fn image_control_key(value: u16) -> Option<&'static str> {
    Some(match value {
        0 => "standard",
        1 => "vivid",
        3 => "monotone",
        6 => "setting_1",
        7 => "setting_2",
        9 => "high_contrast_bw",
        10 => "cross_process",
        11 => "positive_film",
        12 => "bleach_bypass",
        13 => "retro",
        15 => "miniature",
        17 => "high_key",
        _ => return None,
    })
}

pub fn focus_mode_key(value: u16) -> Option<&'static str> {
    Some(match value {
        1 => "manual",
        2 => "multi_af",
        3 => "spot_af",
        4 => "snap",
        5 => "infinity",
        7 => "face",
        8 => "tracking",
        9 => "pinpoint",
        _ => return None,
    })
}

pub fn ricoh_white_balance_key(value: u16) -> Option<&'static str> {
    Some(match value {
        0 => "auto",
        1 => "multi_auto",
        2 => "daylight",
        3 => "cloudy",
        4 => "incandescent_1",
        5 => "incandescent_2",
        6 => "daylight_fluorescent",
        7 => "neutral_fluorescent",
        8 => "cool_fluorescent",
        9 => "warm_fluorescent",
        10 => "manual",
        11 => "kelvin",
        12 => "shade",
        _ => return None,
    })
}

pub fn on_off_key(value: u16) -> Option<&'static str> {
    match value {
        0 => Some("off"),
        1 => Some("on"),
        _ => None,
    }
}

/// Pentax FocusMode (tag 0x000D). Values follow ExifTool's public Pentax table.
pub fn pentax_focus_mode_key(value: u16) -> Option<&'static str> {
    Some(match value {
        0x2 => "infinity",
        0x3 => "manual",
        0x6 => "auto_area",
        0x8 => "select",
        0x9 => "pinpoint",
        0xA => "tracking",
        0xC => "snap",
        _ => return None,
    })
}

/// Pentax WhiteBalance (tag 0x0019). Values follow ExifTool's public Pentax table.
pub fn pentax_white_balance_key(value: u16) -> Option<&'static str> {
    Some(match value {
        0 => "auto",
        1 => "daylight",
        2 => "shade",
        5 => "manual",
        6 => "daylight_fluorescent",
        10 => "cloudy",
        11 => "warm_fluorescent",
        14 => "multi_auto",
        17 => "kelvin",
        _ => return None,
    })
}

/// GR Image Control stored as Pentax ImageTone (tag 0x004F).
///
/// ExifTool documents the GR range as 256–267. DSLR ImageTone values 0–11 are
/// not mapped here.
pub fn pentax_image_tone_key(value: u16) -> Option<&'static str> {
    Some(match value {
        256 => "standard",
        257 => "vivid",
        258 => "monotone",
        259 => "soft_monotone",
        260 => "hard_monotone",
        261 => "high_contrast_bw",
        262 => "positive_film",
        263 => "bleach_bypass",
        264 => "retro",
        265 => "hdr_tone",
        266 => "cross_process",
        267 => "negative_film",
        _ => return None,
    })
}

/// Infer GR IIIx crop mode from the standard Exif 35 mm equivalent.
///
/// Public samples only confirmed the uncropped 40 mm case. 50 mm and 71 mm
/// branches follow the camera's published crop equivalents and are unconfirmed
/// against a cropped original.
pub fn iiix_crop_from_35mm(equiv_35mm: Option<u32>) -> Option<&'static str> {
    match equiv_35mm? {
        38..=44 => Some("off"),
        48..=55 => Some("crop_50"),
        65..=80 => Some("crop_71"),
        _ => None,
    }
}

pub fn format_gps(lat: f64, lat_ref: &str, lon: f64, lon_ref: &str) -> Option<String> {
    if !lat.is_finite() || !lon.is_finite() {
        return None;
    }
    if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
        return None;
    }
    let ns = match lat_ref.as_bytes().first().map(u8::to_ascii_uppercase) {
        Some(b'S') => "S",
        _ => "N",
    };
    let ew = match lon_ref.as_bytes().first().map(u8::to_ascii_uppercase) {
        Some(b'W') => "W",
        _ => "E",
    };
    Some(format!(
        "{}° {}, {}° {}",
        trim_float(lat.abs()),
        ns,
        trim_float(lon.abs()),
        ew
    ))
}

pub fn dms_to_degrees(values: &[f64]) -> Option<f64> {
    if values.len() < 3 {
        return None;
    }
    let deg = values[0];
    let min = values[1];
    let sec = values[2];
    if ![deg, min, sec].iter().all(|value| value.is_finite()) {
        return None;
    }
    Some(deg + min / 60.0 + sec / 3600.0)
}

pub fn format_taken_at(
    year: u32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    second: u32,
) -> Option<String> {
    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 60
    {
        return None;
    }
    Some(format!(
        "{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shutter_uses_reciprocal_for_short_exposures() {
        assert_eq!(format_shutter(1.0 / 500.0).as_deref(), Some("1/500"));
        assert_eq!(format_shutter(2.0).as_deref(), Some("2″"));
    }

    #[test]
    fn iiix_crop_is_never_labelled_as_gr_iii_focal_lengths() {
        assert_eq!(
            crop_mode_key(Some("RICOH GR IIIx"), 0, Some(40)),
            Some("off")
        );
        assert_eq!(
            crop_mode_key(Some("RICOH GR IIIx"), 1, Some(50)),
            Some("crop_50")
        );
        assert_eq!(crop_mode_key(Some("GR IIIx"), 2, Some(71)), Some("crop_71"));
        assert_ne!(
            crop_mode_key(Some("RICOH GR IIIx"), 1, Some(50)),
            Some("crop_35")
        );
        assert_ne!(
            crop_mode_key(Some("RICOH GR IIIx"), 2, Some(71)),
            Some("crop_47")
        );
        assert_eq!(
            crop_mode_key(Some("RICOH GR III"), 1, Some(35)),
            Some("crop_35")
        );
        assert_eq!(
            crop_mode_key(Some("RICOH GR III"), 2, Some(47)),
            Some("crop_47")
        );
        assert_eq!(crop_mode_key(None, 1, Some(50)), Some("crop_50"));
        assert_eq!(crop_mode_key(None, 1, None), Some("on"));
    }

    #[test]
    fn pentax_gr_keys_follow_exiftool_tables() {
        assert_eq!(pentax_image_tone_key(256), Some("standard"));
        assert_eq!(pentax_image_tone_key(258), Some("monotone"));
        assert_eq!(pentax_image_tone_key(262), Some("positive_film"));
        assert_eq!(pentax_image_tone_key(0), None);
        assert_eq!(pentax_focus_mode_key(0x3), Some("manual"));
        assert_eq!(pentax_focus_mode_key(0x6), Some("auto_area"));
        assert_eq!(pentax_focus_mode_key(0x8), Some("select"));
        assert_eq!(pentax_focus_mode_key(0xC), Some("snap"));
        assert_eq!(pentax_white_balance_key(5), Some("manual"));
        assert_eq!(pentax_white_balance_key(14), Some("multi_auto"));
        assert_eq!(pentax_white_balance_key(17), Some("kelvin"));
        assert_eq!(iiix_crop_from_35mm(Some(40)), Some("off"));
        assert_eq!(iiix_crop_from_35mm(Some(50)), Some("crop_50"));
        assert_eq!(iiix_crop_from_35mm(Some(71)), Some("crop_71"));
        assert_ne!(iiix_crop_from_35mm(Some(50)), Some("crop_35"));
        assert_eq!(iiix_crop_from_35mm(Some(35)), None);
    }

    #[test]
    fn aspect_detects_three_two_and_square() {
        assert_eq!(aspect_ratio(6000, 4000).as_deref(), Some("3:2"));
        assert_eq!(aspect_ratio(4000, 4000).as_deref(), Some("1:1"));
    }
}
