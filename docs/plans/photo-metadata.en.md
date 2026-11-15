# Photographer information on the detail page

This document describes which information to show a photographer on the detail page, how those values are typically stored in GR IIIx JPEG and DNG files, and how far the app can go without decoding RAW pixels. The photographer panel described here is implemented. Standard Exif is read with kamadak-exif. Ricoh MakerNote fields are parsed by a small dedicated reader. The current mapping follows public specifications, ExifTool's Ricoh tag documentation, and synthetic fixtures. MakerNote layouts must be checked against real GR IIIx JPEG and DNG files before the displayed labels are treated as final.

## Information to show

Group the panel the way a photographer reads a photograph, not by metadata tag names. Omit a row when the value is absent, or mark it as unavailable. Do not put the absolute path in the first group.

**Exposure**

- Aperture
- Shutter speed
- ISO
- Exposure compensation
- Exposure mode (program AE, aperture priority, shutter priority, manual, snap-distance priority, and similar)
- Metering mode (multi-segment, center-weighted, spot, highlight-weighted)

**Lens and framing**

- Camera and lens (on the GR IIIx, 18.3 mm, F2.8)
- Focal length, with the 35 mm equivalent. Uncropped, that equivalent is about 40 mm. With crop, it is about 50 mm or 71 mm
- The crop mode itself, so it can be read next to the equivalent focal length

**Color and focus**

- White balance, and color temperature when present
- Image Control, matching the camera's Image Control setting
- Focus mode, with Snap and Full Press Snap called out
- The built-in ND filter, when present

**File**

- Date and time the photograph was taken
- Format (JPEG or DNG) and file size
- Pixel dimensions and aspect ratio (3:2 or 1:1)
- Color space (sRGB or Adobe RGB)
- GPS, only when the file contains it
- A histogram

The file name that already appears in the large-image viewer can stay in the detail page's top region. If the absolute path is kept, place it at the end of the File group, or in a secondary place. Do not put it next to aperture and shutter speed.

## What JPEG and DNG files typically contain

The GR IIIx can record JPEG, DNG, or RAW+JPEG. The official specification describes still images as Exif 2.3 JPEG and 14-bit DNG, with sRGB or Adobe RGB as the color space. The uncropped 35 mm equivalent focal length is 40 mm. The crop settings are 50 mm and 71 mm.

Standard Exif and TIFF fields usually include the camera model, lens or focal length, 35 mm equivalent focal length, aperture, shutter, ISO, exposure compensation, exposure program, metering mode, white balance, date and time, pixel dimensions, color space, and GPS when it was recorded. These fields can generally be read from both JPEG and DNG without decoding the image itself.

The following items are usually stored in the Ricoh MakerNote, not in standard Exif:

- Image Control
- Focus mode, including Snap
- Full Press Snap
- Crop mode
- ND filter
- Some white-balance details and color temperature

ExifTool records Ricoh `CropMode` as Off, 35 mm, or 47 mm, which matches the GR III crop settings. The GR IIIx settings are 50 mm and 71 mm. The panel must not label those values as 35 mm and 47 mm. Interpret them with the camera model or the 35 mm equivalent focal length. Confirm the exact MakerNote encoding against real JPEG and DNG files when those files are available, and only then lock the labels. That confirmation is not a prerequisite for starting the work.

DNG files often also carry an embedded JPEG preview. That preview can be used to show the photograph on the detail page, and to estimate a histogram without a RAW decode. A preview is not the sensor sample. If the histogram is built from it, the panel should say so.

## Rust crates and licenses

| Crate | License | Role | Fit for this work |
| --- | --- | --- | --- |
| [kamadak-exif](https://crates.io/crates/kamadak-exif) 0.6.2 | BSD-2-Clause | Reads Exif from JPEG, TIFF, and TIFF-like structures | The first-phase choice for standard fields. The license is permissive and is fine to ship. MakerNotes are exposed mainly as raw bytes, without Ricoh-specific tags. The crate also has no ready API for DNG SubIFD previews. |
| [rexif](https://crates.io/crates/rexif) 0.7.6 | MIT | Reads Exif from JPEG and TIFF | A reasonable alternative with a similar first-phase scope, and a smaller ecosystem than kamadak-exif. |
| [little_exif](https://crates.io/crates/little_exif) | MIT or Apache-2.0 | Reads and writes Exif in several formats | Also permissively licensed. This feature only needs reads, so write support is not a reason to add it. Its DNG behavior needs a separate check, and should not be assumed to match JPEG. |
| [image](https://crates.io/crates/image) | MIT or Apache-2.0 | Decodes JPEG and other rasters into pixels | Use it for JPEG histograms, and to decode a JPEG preview extracted from a DNG. |
| [rawler](https://crates.io/crates/rawler) 0.8.0 | LGPL-2.1 | Decodes camera RAW files and reads their metadata | It can produce true DNG pixels and a RAW histogram, but LGPL-2.1 creates obligations for an app that is shipped mainly as a statically linked package. If it is adopted later, those obligations have to be decided first. Do not add it without that review. |
| [gamut-dng](https://crates.io/crates/gamut-dng) | MIT or Apache-2.0 | Encodes and decodes DNG to the specification | The license is permissive, but the project is new and little used. It is not a first-phase dependency. |

The first phase should use kamadak-exif for standard Exif. A small dedicated parser should read only the Ricoh MakerNote fields listed above. JPEG histograms should be computed from pixels decoded by `image`. DNG previews and preview-based histograms should come from a read-only TIFF/DNG preview extractor, without rawler and without demosaicing the CFA.

Do not call or bundle ExifTool in order to read metadata. The app should keep reading the user's photographs and should not write back to JPEG or DNG files.

## What is feasible without a RAW decode

Feasible now:

- Reading standard exposure fields, focal length and its 35 mm equivalent, color space, date and time, file size and format, and optional GPS, from both JPEG and DNG
- Showing Image Control, Snap, crop, and ND, and confirming MakerNote layouts against real files when those files are available, before locking the labels
- Showing the detail image for previewable JPEGs, with a histogram computed from the original pixels
- If a DNG embedded preview can be extracted, showing that preview and a histogram computed from it, labeled as such

Leave for later work:

- A detailed, inspectable view of the DNG original (the album still shows a "can't preview" placeholder for DNG)
- A histogram computed from DNG sensor data
- A waveform or RAW-level histogram that reflects linear RAW values

Those items belong with a later RAW preview effort, not with the photographer information panel. The album grid uses the same read-only embedded JPEG extraction for DNG thumbnails. That is not a sensor-level RAW decode. Using rawler for a true RAW decode requires a decision on LGPL-2.1 first. macOS ImageIO, or another decoder, remains an option for a later sensor-level preview after a license review.

## Layout

Put the information in a collapsible side panel on the right of the detail page. Do not keep the current lower-left floating card as the final layout. The panel is open by default when the window is wide enough, and collapses when the window is narrow, so it does not squeeze the photograph. `I` and the existing Info control continue to show or hide the panel.

The panel uses a translucent surface, in line with the frosted-glass window. Each row is a short label and a value. The exposure group comes first, at a size that makes aperture, shutter, and ISO easy to read at a glance. The implemented order then shows lens and crop, image settings, capture time and file information, GPS when present, and the histogram last. When there is no GPS, the row is omitted. The absolute file path is not shown.

The shortcut list still opens with `?`. It does not share the photographer information panel.

## Phases

1. The detail page is in place, and photographer information sits in the right-hand panel.
2. kamadak-exif and a Ricoh MakerNote parser are in the same crate. The panel shows standard exposure fields, focal length, color space, date and time, and optional GPS, together with Image Control, focus (including Snap), crop, ND, and color temperature. Crop on GR IIIx files is labeled 40 mm when off, or 50 mm or 71 mm when cropped. It does not use ExifTool's GR III CropMode labels of 35 mm and 47 mm. MakerNote layouts must be checked against real GR IIIx JPEG and DNG files before the displayed labels are treated as final.
3. A histogram is computed from original JPEG pixels. For a DNG with an extracted embedded preview, the histogram is computed from that preview and labeled as such.
4. A RAW original preview and a sensor-data histogram remain for a later version, with a separate decision on the decoder and its license.

## Decisions already made

Confirmed on 15 November 2026 (Asia/Shanghai): implement Ricoh MakerNotes (Image Control, Snap, crop, ND, and the other MakerNote fields listed above) in the same phase as standard Exif. Do not wait for real GR IIIx samples before starting that work. When real GR IIIx files are available, still confirm the MakerNote layouts against them. Do not reuse ExifTool's GR III CropMode labels (35 mm / 47 mm) for the IIIx (40 mm / 50 mm / 71 mm).

The implementation uses kamadak-exif with a dedicated Ricoh MakerNote parser. The information panel does not show the absolute file path.

## Remaining decisions

- Whether a later true DNG pixel histogram should accept rawler's LGPL-2.1 license, or use a system API such as ImageIO.
