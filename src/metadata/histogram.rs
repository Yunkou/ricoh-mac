//! Luminance-preserving RGB histograms from decoded JPEG pixels.

use image::GenericImageView;

const BINS: usize = 256;
const MAX_PIXELS: u64 = 1_000_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Histogram {
    pub red: Vec<u32>,
    pub green: Vec<u32>,
    pub blue: Vec<u32>,
}

impl Histogram {
    fn empty() -> Self {
        Self {
            red: vec![0; BINS],
            green: vec![0; BINS],
            blue: vec![0; BINS],
        }
    }
}

pub fn from_jpeg_bytes(bytes: &[u8]) -> Option<Histogram> {
    let image = image::load_from_memory(bytes).ok()?;
    from_dynamic(&image)
}

fn from_dynamic(image: &image::DynamicImage) -> Option<Histogram> {
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 {
        return None;
    }
    let pixels = u64::from(width) * u64::from(height);
    let rgb = if pixels > MAX_PIXELS {
        let scale = (MAX_PIXELS as f64 / pixels as f64).sqrt();
        let new_w = ((f64::from(width) * scale).round() as u32).max(1);
        let new_h = ((f64::from(height) * scale).round() as u32).max(1);
        image
            .resize(new_w, new_h, image::imageops::FilterType::Triangle)
            .to_rgb8()
    } else {
        image.to_rgb8()
    };
    let mut histogram = Histogram::empty();
    for pixel in rgb.pixels() {
        histogram.red[pixel[0] as usize] += 1;
        histogram.green[pixel[1] as usize] += 1;
        histogram.blue[pixel[2] as usize] += 1;
    }
    Some(histogram)
}

#[cfg(test)]
mod tests {
    use super::{BINS, from_jpeg_bytes};
    use image::{ImageFormat, Rgb, RgbImage};
    use std::io::Cursor;

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

    #[test]
    fn counts_a_solid_red_jpeg_in_the_high_red_bin() {
        let bytes = solid_jpeg(255, 0, 0);
        let histogram = from_jpeg_bytes(&bytes).expect("histogram");
        assert_eq!(histogram.red.len(), BINS);
        let red_peak = histogram
            .red
            .iter()
            .enumerate()
            .max_by_key(|(_, count)| *count)
            .map(|(index, _)| index)
            .unwrap();
        let green_peak = histogram
            .green
            .iter()
            .enumerate()
            .max_by_key(|(_, count)| *count)
            .map(|(index, _)| index)
            .unwrap();
        assert!(red_peak > 200, "red peak at {red_peak}");
        assert!(green_peak < 40, "green peak at {green_peak}");
    }
}
