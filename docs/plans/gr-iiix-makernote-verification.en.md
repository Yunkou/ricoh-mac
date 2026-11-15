# GR IIIx photographer-information verification

Date: 15 November 2026, Asia/Shanghai.

This note records a check of the app’s standard Exif and MakerNote reading against publicly downloadable, out-of-camera Ricoh GR IIIx JPEG and DNG files. The check covers the photographer panel fields named in the product plan: camera model, crop (40 mm when off, 50 mm or 71 mm when cropped), Image Control, Snap, Full Press Snap, the ND filter, and color temperature.

Original sample photographs are not stored in the repository. Serial numbers, GPS coordinates, and photographer personal information are omitted from this note and from committed fixtures.

## Sources examined

The following public sources were consulted. Paid registration was not used, and no site block was bypassed. Private photograph directories on the development machine were not scanned.

| Source | Result |
| --- | --- |
| [raw.pixls.us](https://raw.pixls.us/) repository | One GR IIIx 14-bit DNG, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Used. |
| Imaging Resource [GR IIIx samples](https://www.imaging-resource.com/cameras/ricoh-gr-iiix-review/samples/) and [gallery](https://www.imaging-resource.com/cameras/ricoh-gr-iiix-review/gallery/) | Out-of-camera studio DNG and a gallery JPEG were downloadable for local, private, non-commercial evaluation under the site’s [legacy usage](https://old.imaging-resource.com/USAGE.HTM) and [terms of use](https://www.imaging-resource.com/terms-of-use/). Used locally only; not redistributed and not committed. |
| Imaging Resource studio “FULLRES” JPEG `GR3xhSLI000100NR0.JPG` | The currently served file is a 6 000 × 4 000 JFIF image with almost no Exif or MakerNote data. It was not used for MakerNote verification. |
| Imaging Resource gallery DNG for `Y-WB-GRIIIx-R0000001` | The matching DNG URL returned HTTP 404. |
| Photography Blog review and sample pages | HTTP 403. The block was not bypassed. |
| rawsamples.ch | Lists older Ricoh GR / GR Digital bodies. No GR IIIx original was found. |
| DPReview, PetaPixel, and Popular Photography sample galleries | Noted as secondary leads. Some DPReview files are converted with Adobe Camera Raw. They were not downloaded once clearly licensed out-of-camera JPEG and DNG files were already in hand. |

All Imaging Resource gallery stills listed on the public gallery page are 6 000 × 4 000 or 4 000 × 6 000 pixels with a 26.0 mm lens. No public cropped 50 mm or 71 mm original was found.

## Local files retained for development

The files live only in a development cache, not in the repository:

`/Users/coco/Library/Caches/ricoh-mac/gr-iiix-samples/`

| File | SHA-256 | License / use | Model evidence |
| --- | --- | --- | --- |
| `pixls-us/Ricoh - GR IIIx - 14bit (3:2).DNG` (31 357 843 bytes) | `1e318af31be4baa9949f0ed4af5cfe8ffb2c180e2c12926cd75ac1d029bb0fae` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Source: [raw.pixls.us file 5818](https://raw.pixls.us/getfile.php/5818/nice/Ricoh%20-%20GR%20IIIx%20-%2014bit%20(3:2).DNG). | IFD0 / UniqueCameraModel `RICOH GR IIIx`, software `RICOH GR IIIx Ver. 1.02`. The published SHA-256 from raw.pixls.us matches the download. |
| `imaging-resource/GR3xhSLI000100NR0.DNG` (34 280 956 bytes) | `96638377c5f49f14074491f67fe2d34a9381048e74b30997d651eaf7854f54f4` | Imaging Resource local private non-commercial evaluation only. Must not be republished or committed. Source: [FULLRES DNG](https://www.imaging-resource.com/PRODS/ricoh-gr-iiix/FULLRES/GR3xhSLI000100NR0.DNG) (served from the site’s media/legacy host). | IFD0 model `RICOH GR IIIx`, software `RICOH GR IIIx Ver. 1.00`. Out-of-camera studio RAW (filename suffix `NR0`). |
| `imaging-resource/Y-WB-GRIIIx-R0000001.JPG` (14 288 082 bytes) | `9c57fbb94fa66b5e087d5e83a5643bcf46ac952730bacd880339bbb60d795af1` | Same Imaging Resource local-use terms as above. Source: [FULLRES JPEG](https://old.imaging-resource.com/PRODS/ricoh-gr-iiix/FULLRES/Y-WB-GRIIIx-R0000001.JPG). | IFD0 model `RICOH GR IIIx`, software `RICOH GR IIIx Ver. 1.00`. 4 000 × 6 000 out-of-camera JPEG with a complete MakerNote. |

## Method

Expectations were not invented. Field names and enumerations were taken from ExifTool’s public [Ricoh](https://exiftool.org/TagNames/Ricoh.html) and [Pentax](https://exiftool.org/TagNames/Pentax.html) tag documentation, then compared with ExifTool 13.55 on the files above and with `inspect_photo` in this crate. ExifTool was installed on the development machine only as a verification dependency. It is not bundled in the app.

## Layout found in real GR IIIx files

The ExifTool Ricoh table (`CropMode` 0x1018 = Off / 35 mm / 47 mm, `ImageEffects` 0x1010, and related 0x10xx tags) is **not** the layout written by the GR IIIx files examined here.

Both the JPEG MakerNote (Exif tag 0x927C) and the DNG MakerNote (TIFF/DNG tag 0xC634, `DNGPrivateData`) start with `RICOH\0` followed by an endian marker `II` and the IFD entry count. There is no TIFF magic 42 and no 4-byte IFD offset. ExifTool 13.55 decodes that IFD as Pentax tags. kamadak-exif does not expose 0xC634, so a DNG file must have that tag read separately.

The previous reader only followed Exif tag 0x927C and a standard TIFF header after a `Ricoh` prefix. On these real files it therefore returned no Image Control, focus, ND, or related MakerNote values. That is a root-cause defect, not a missing label. The reader now recognizes the compact `RICOH\0` + endian + IFD layout, reads DNG 0xC634 when 0x927C is absent, and maps only the photographer-panel fields that ExifTool documents for this Pentax-layout IFD. The older Ricoh 0x10xx mapping is kept for existing synthetic fixtures and for any file that still uses that layout. The parser does not grow into a general Pentax decoder, and it does not read serial numbers or GPS from the MakerNote.

## Field-by-field coverage

These results are limited to the three legal samples above. This is **not** full coverage.

| Field | Real-shot coverage | Evidence (non-sensitive) | Still unverified |
| --- | --- | --- | --- |
| Camera model | Verified on JPEG and DNG | `RICOH GR IIIx` on all three files | Other firmware branches only as listed above (1.00 and 1.02) |
| Crop off / 40 mm | Verified | Standard Exif `FocalLengthIn35mmFormat` is 40 mm; pixel size is 6 000 × 4 000 or 4 000 × 6 000; Pentax `AspectRatio` is 3:2 | — |
| Crop 50 mm and 71 mm | Not verified | No public original with a 50 mm or 71 mm equivalent was found. ExifTool did not publish a GR IIIx-specific 50/71 mapping for these files’ `0x0098` values. The app may infer crop from the standard 35 mm equivalent (40 / 50 / 71) when the model is GR IIIx and no Ricoh `CropMode` tag is present. The 50 mm and 71 mm branches of that inference are unconfirmed. | Cropped originals; any MakerNote crop tag that distinguishes 50 mm from 71 mm |
| Image Control | Verified for Standard and Monotone only | Pentax `ImageTone` 256 = Standard (studio DNG and gallery JPEG); 258 = Monotone (pixls.us DNG), per ExifTool’s Pentax table | Vivid, Positive Film, and the other documented 256–267 values |
| Focus, including Snap | Verified for Manual, Auto-area, and Select | Pentax `FocusMode` 3 = Manual, 6 = Auto-area, 8 = Select | Snap (`0x0C` in the same public table) was not present in these files |
| Full Press Snap | Not verified | No Full Press Snap tag was present in these MakerNotes | Any file that records the setting |
| ND filter | Verified for Off only | Pentax `NeutralDensityFilter` `0 0` = Off (Off), `0 2` = Off (Auto). The app records the first byte as on/off, which matches ExifTool’s documented pairs | ND On (`1 1` / `1 2`) |
| Color temperature / Kelvin white balance | Not verified | `ColorTemperature` was 0, and white balance was Multi Auto or Manual, not Kelvin | A file shot with Kelvin white balance and a 1 000–20 000 K value |

White balance Multi Auto and Manual were present and match ExifTool’s Pentax `WhiteBalance` table (values 14 and 5). Those values are now displayed. They were not a named goal of this item, and other white-balance presets remain unconfirmed on a real IIIx file.

## Tests

Behavior tests cover the compact `RICOH\0` layout, the Pentax tag mappings taken from ExifTool, JPEG Exif MakerNotes, DNG 0xC634, and the uncropped 40 mm crop inference. Existing tests for the older Ricoh 0x10xx layout still pass. When the three cached files above are present at their recorded sizes, `public_gr_iiix_samples_match_verified_facts_when_present` checks the same non-sensitive facts through `inspect_photo`. The original bytes are only read.

## Notes for full RAW development and histogram (not implemented)

This section is evidence for a later item. It does not implement RAW development.

On this development Mac (macOS 27.0.1, build 26A434), `CIRAWFilter.supportedCameraModels` listed 917 models, including `PENTAX RICOH GR`, `PENTAX RICOH GR II`, and `PENTAX RICOH GR III`. It did **not** list GR IIIx.

Despite that omission, `CIRAWFilter(imageURL:)` opened the CC0 pixls.us GR IIIx DNG, produced an output image of 6 000 × 4 000 pixels, and a tiny software render of an 8 × 8 crop succeeded. A DNG already carries calibration matrices, so Core Image can develop this file even when the camera name is absent from the supported-model list. That is a runtime observation, not a claim that every IIIx DNG or every macOS version will behave the same way.

Core Image and ImageIO are system frameworks distributed with macOS under Apple’s software license. An app may link them as ordinary system dependencies. The Apple SDK must not be redistributed, and this work does not vendor Apple headers or binaries. A later Rust bridge is feasible as a small Swift (or Objective-C) helper that calls `CIRAWFilter` and returns bitmap or histogram data across a narrow FFI, without rewriting Apple’s decoder in Rust.

For that later work, the CC0 pixls.us DNG at the cache path above is the clearly redistributable local sample. The Imaging Resource DNG may be used for additional private local checks under the site’s terms, but it must not be committed or published.

