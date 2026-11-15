# Photographer information on the detail page

This document describes which information to show a photographer on the detail page, how those values are typically stored in GR IIIx JPEG and DNG files, and which image each preview and histogram comes from. The photographer panel described here is implemented. The detail page can also show a RAW-developed preview of a local DNG, as described below. Standard Exif is read with kamadak-exif. Ricoh MakerNote fields are parsed by a small dedicated reader. The mapping follows public specifications and ExifTool's Ricoh and Pentax tag documentation. On 15 November 2026 (Asia/Shanghai) it was checked against public, out-of-camera GR IIIx JPEG and DNG files. Real IIIx files use a compact Pentax-layout MakerNote; the older Ricoh 0x10xx layout remains supported for fixtures. Verified and unverified fields are listed in [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md). Labels for fields that those samples did not cover are not treated as final.

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

The following items are usually stored in the MakerNote, not in standard Exif:

- Image Control
- Focus mode, including Snap
- Full Press Snap
- Crop mode
- ND filter
- Some white-balance details and color temperature

Real GR IIIx JPEG and DNG files examined on 15 November 2026 store these values in a compact Pentax-layout MakerNote, which ExifTool documents in its Pentax table (`ImageTone`, `FocusMode`, `NeutralDensityFilter`, and related tags). The older ExifTool Ricoh table records `CropMode` as Off, 35 mm, or 47 mm, which matches the GR III crop settings and was not the layout of those IIIx files. The GR IIIx crop settings remain 50 mm and 71 mm. The panel must not label a GR IIIx file as 35 mm or 47 mm. When no Ricoh `CropMode` tag is present, the app may follow the standard 35 mm equivalent (40 / 50 / 71). Public samples confirmed only the uncropped 40 mm case. See [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md).

DNG files often also carry an embedded JPEG preview. The album grid uses only that embedded preview. The detail page can show the embedded preview, or it can build a display image from the DNG sensor data through system Core Image `CIRAWFilter.outputImage`. An embedded preview is not the sensor sample. A RAW develop is a color-managed rendered image, not linear sensor data. The histogram must be computed from the image actually shown, and labeled by source: embedded preview, RAW develop, or original JPEG.

## Rust crates and licenses

| Crate | License | Role | Fit for this work |
| --- | --- | --- | --- |
| [kamadak-exif](https://crates.io/crates/kamadak-exif) 0.6.2 | BSD-2-Clause | Reads Exif from JPEG, TIFF, and TIFF-like structures | The first-phase choice for standard fields. The license is permissive and is fine to ship. MakerNotes are exposed mainly as raw bytes, without Ricoh-specific tags. The crate also has no ready API for DNG SubIFD previews. |
| [rexif](https://crates.io/crates/rexif) 0.7.6 | MIT | Reads Exif from JPEG and TIFF | A reasonable alternative with a similar first-phase scope, and a smaller ecosystem than kamadak-exif. |
| [little_exif](https://crates.io/crates/little_exif) | MIT or Apache-2.0 | Reads and writes Exif in several formats | Also permissively licensed. This feature only needs reads, so write support is not a reason to add it. Its DNG behavior needs a separate check, and should not be assumed to match JPEG. |
| [image](https://crates.io/crates/image) | MIT or Apache-2.0 | Decodes JPEG and other rasters into pixels | Use it for JPEG histograms, and to decode a JPEG preview extracted from a DNG. |
| [rawler](https://crates.io/crates/rawler) 0.8.0 | LGPL-2.1 | Decodes camera RAW files and reads their metadata | Not used. LGPL-2.1 would create obligations for an app that is shipped mainly as a statically linked package. Detail-page RAW develop uses system Core Image `CIRAWFilter` instead, linking system frameworks only and not redistributing the Apple SDK. |
| `cc` 1.x and `native/ricoh_raw.m` in this repository | MIT or Apache-2.0 (`cc`); project-owned Objective-C interface | Compiles and statically links a narrow `CIRAWFilter` wrapper on macOS | Adopted. No extra dylib or SDK is shipped. |
| [gamut-dng](https://crates.io/crates/gamut-dng) | MIT or Apache-2.0 | Encodes and decodes DNG to the specification | The license is permissive, but the project is new and little used. It is not a first-phase dependency. |

Standard Exif is read with kamadak-exif. A small dedicated parser reads only the Ricoh MakerNote fields listed above. JPEG histograms are computed from original pixels decoded by `image`. Embedded DNG previews, and histograms computed from them, come from a read-only TIFF/DNG preview extractor. Detail-page RAW develop and the rendered histogram use system `CIRAWFilter.outputImage`. rawler is not used.

Do not call or bundle ExifTool in order to read metadata. The app should keep reading the user's photographs and should not write back to JPEG or DNG files.

## What previews and histograms can already do

Feasible now:

- Reading standard exposure fields, focal length and its 35 mm equivalent, color space, date and time, file size and format, and optional GPS, from both JPEG and DNG
- Showing Image Control, focus (including Snap when present), crop, and ND from the MakerNote layouts confirmed against public GR IIIx JPEG and DNG files. Fields those samples did not cover are listed in [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md) and are not treated as final
- Showing the detail image for previewable JPEGs, with a histogram computed from the original pixels
- If a DNG embedded preview can be extracted, the album grid and the detail page can show that preview, with a histogram computed from it and labeled as such
- The detail page can develop a display image from local DNG sensor data, compute a rendered-image histogram from that same output, and label the source. The display raster may be downsampled for the UI. It is not an upgrade of the embedded preview

Still not provided:

- A waveform or linear sensor histogram that reflects linear RAW values
- A systematic check that Apple's default develop matches in-camera Image Control and white balance

The album grid still uses only the read-only embedded JPEG extraction for DNG thumbnails. rawler is not used. The license conclusion is recorded in [the tech stack](../tech-stack.en.md), section 7.

## Layout

Put the information in a collapsible side panel on the right of the detail page. Do not keep the current lower-left floating card as the final layout. The panel is open by default when the window is wide enough, and collapses when the window is narrow, so it does not squeeze the photograph. `I` and the existing Info control continue to show or hide the panel.

The panel uses a translucent surface, in line with the frosted-glass window. Each row is a short label and a value. The exposure group comes first, at a size that makes aperture, shutter, and ISO easy to read at a glance. The implemented order then shows lens and crop, image settings, capture time and file information, GPS when present, and the histogram last. When there is no GPS, the row is omitted. The absolute file path is not shown.

The shortcut list still opens with `?`. It does not share the photographer information panel.

## Phases

1. The detail page is in place, and photographer information sits in the right-hand panel.
2. kamadak-exif and a dedicated MakerNote parser are in the same crate. The panel shows standard exposure fields, focal length, color space, date and time, and optional GPS, together with Image Control, focus (including Snap), crop, ND, and color temperature. Crop on GR IIIx files is labeled 40 mm when off, or 50 mm or 71 mm when cropped. It does not use ExifTool's GR III CropMode labels of 35 mm and 47 mm. Real IIIx files use a compact Pentax-layout MakerNote; the older Ricoh 0x10xx layout remains supported. Public-sample coverage and remaining gaps are recorded in [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md).
3. A histogram is computed from original JPEG pixels. For a DNG with an extracted embedded preview, the histogram is computed from that preview and labeled as such.
4. The detail page can already develop a local DNG through `CIRAWFilter.outputImage` and compute a rendered-image histogram from that same output. A linear sensor histogram and a waveform are still not provided.

## Decisions already made

Confirmed on 15 November 2026 (Asia/Shanghai): implement MakerNotes (Image Control, Snap, crop, ND, and the other MakerNote fields listed above) in the same phase as standard Exif. Do not wait for real GR IIIx samples before starting that work. Do not reuse ExifTool's GR III CropMode labels (35 mm / 47 mm) for the IIIx (40 mm / 50 mm / 71 mm).

Later on the same date, public out-of-camera GR IIIx JPEG and DNG files were used to confirm the layouts. Real IIIx files use a compact Pentax-layout MakerNote. The older Ricoh 0x10xx parser is kept for fixtures. The coverage and the fields that remain unverified are recorded in [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md).

The implementation uses kamadak-exif with a dedicated MakerNote parser. The information panel does not show the absolute file path.

## Remaining decisions

- Whether and when to offer a linear sensor histogram or waveform. The decoder and license are settled: use system `CIRAWFilter`, and do not add rawler.
