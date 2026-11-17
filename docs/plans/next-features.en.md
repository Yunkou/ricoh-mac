# Next features

This document lists work that has already been decided or recorded in the requirements and plans, and recommends an order. It does not introduce features that were never asked for or planned.

## Publish to the remote repository

On the M6 computer, run `gh auth refresh -s workflow` with the Yunkou account. After that authorization, push the two commits on local `main` to `origin/main`. Those commits are the release-workflow cache and parallel split, and the photo detail page with the photographer information panel. This step does not create a tag and does not publish a release. Pushing workflow files requires the `workflow` scope.

## Next implementation

The recommended order is as follows. The first two items are needed for the next release and for the quality of work already implemented. The items after that continue the version 1 milestones.

1. **Product-style release notes, starting from the next version.** Follow [release-notes.en.md](release-notes.en.md) and change the release workflow so that it reads the matching bilingual notes under `docs/releases/`, then appends the install steps and the checksum section. The install steps are: unzip, drag into Applications, then Control-click and choose Open. The checksum comes last. The release job should fail if the notes file for that version is missing. Do not rewrite the published v0.2.0 GitHub Release page. Keep `docs/releases/v0.2.0.zh-CN.md` and `docs/releases/v0.2.0.en.md` as the template for later versions. This item comes first because the next tagged release needs the new page format.

2. **Confirm Ricoh MakerNotes against real GR IIIx files.** Checked on 15 November 2026 (Asia/Shanghai) against publicly downloadable, out-of-camera GR IIIx JPEG and DNG files. The details, sources, and remaining gaps are in [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md). Real IIIx files use a compact Pentax-layout MakerNote, not the ExifTool Ricoh 0x10xx table the first parser expected; that defect is fixed. Verified: model, uncropped 40 mm, Image Control Standard and Monotone, focus Manual / Auto-area / Select, and ND Off. Not verified, and not claimed as fully covered: crop 50 mm and 71 mm, Snap, Full Press Snap, ND On, Kelvin color temperature, and other Image Control styles. Crop on GR IIIx files is still labeled 40 mm when off, or 50 mm or 71 mm when cropped, and is never labeled with the GR III values 35 mm or 47 mm. This item follows the existing detail page. It confirms work already implemented; it is not a new feature.

3. **DNG preview in the album grid.** Implemented. The album grid reuses the detail page’s read-only extraction: when an embedded JPEG preview is present, the cell shows that thumbnail from `preview-cache`; when the preview is missing or unusable, the cell uses the existing “cannot preview” placeholder. The original file is not written back. This is not a sensor-level RAW decode.

4. **Culling: 1 to 5 stars, plus picked and rejected.** Implemented. This is Milestone 3 in the requirements. A photograph can have 1 to 5 stars or remain unrated, and a single flag: picked, rejected, or none. Picked and rejected are mutually exclusive; the star rating is independent of the flag. The album grid and the photo detail page show the same marks and both offer pointer editing. Shortcuts, active in Photos and the detail page when a photograph is focused or viewed, and only when not editing text, are: `0`–`5` set the rating (`0` clears it; pressing the same star again also clears it), `P` toggles picked, `X` toggles rejected, and `U` clears the flag only. The album can be filtered by flag or by star rating.

   Marks are written to a canonical XMP sidecar named `{file_name}.xmp`, including the photograph's extension, for example `R0001234.JPG.xmp` and `R0001234.DNG.xmp`. A same-stem JPEG/DNG pair therefore keeps two sidecars, and a write never overwrites the other photograph's marks. A `{stem}.xmp` file such as `R0001234.xmp` is read only when no sibling in the folder shares that stem; writes always go to the canonical path and leave `{stem}.xmp` untouched. The rating is stored as `xmp:Rating` with values 0 to 5. A value of `-1` (Adobe's rejected rating) is read as unrated and is not written, so reject is not coupled to the star value. The flag is stored as `ricohMac:Flag` (`picked` or `rejected`) in the namespace `http://ns.yunkou.ricoh-mac/1.0/`; the attribute is omitted when the flag is none. Unknown XMP fields and namespaces are kept. A corrupt existing sidecar is left unchanged and reported as an error. Writes are atomic (a hidden `.name.{pid}.partial` file renamed into place). Path names are rejected when they would traverse, and documents that contain `<!DOCTYPE>` or `<!ENTITY>` are rejected.

   The same marks are mirrored into a rebuildable SQLite index under `data_dir()/cull-index.sqlite`, keyed by the canonical library path and file name. The sidecar is the source of truth. If the sidecar is missing, a previous index row may be shown. If the sidecar write fails, the index is not updated and the UI does not treat the change as saved. If the sidecar write succeeds and the index then fails, the error is still returned so a later load can rebuild the index. Original JPEG and DNG bytes are never written, and marks are not written back to the camera.

5. **A RAW-developed detail preview and rendered histogram.** Done. For a local DNG, the detail page automatically (or when the user switches) builds a display raster from DNG sensor data through macOS Core Image `CIRAWFilter.outputImage`. `CIRAWFilter.previewImage` and the default embedded JPEG from `CGImageSource` must not be treated as a RAW decode. The raster may be downsampled for the UI (long-edge cap 4096). That is not an upgrade of the embedded JPEG, and a tiny probe raster must not be treated as success. While loading, an existing embedded preview stays visible; on failure the page falls back to that preview and labels the source. The histogram is computed from the same developed JPEG and is labeled as a rendered-image histogram from the RAW develop, not as a linear sensor histogram. Existing JPEG histograms are unchanged. Developed JPEGs are cached under `data_dir()/raw-preview-cache` and are invalidated by source size, mtime, and render version. Only one develop runs at a time. Stale results are dropped when the photograph changes. Originals are read-only. `rawler` is not used. System frameworks are linked only; the SDK is not redistributed. The minimum OS remains macOS 14. This is the second part of Milestone 4.

## Later milestones

- **How version 1 meets the RAW preview requirement if wireless transfer cannot deliver DNG.** This remains in the hardware-validation list in the requirements document, and will be decided after a real-camera test.
- **An application LICENSE file.** The repository already ships license texts for the font and the icons. The application itself does not yet include a LICENSE file.
- **The public application name and the final bundle identifier.** The current development identifier is `com.yunkou.ricoh-mac`. It is not the final identity.
- **More saturated icon accents.** Change these only if there is a clear request for it.

## Still-open decisions

- The public application name and the final bundle identifier.
- Whether the release title should be “Ricoh Mac”, or should keep the current application file name.
- Whether the release notes should keep a commit-comparison link at the end.
- Whether the icon accents should be more saturated.
- Whether the application should include a LICENSE file.

The remaining camera HTTP items in section 9 of the requirements document still need hardware validation. They are not expanded here as product features.

## Relation to the product-research plan

A separate recommendation based on public sources was written on 16 November 2026 (Asia/Shanghai). See [product-research-next.en.md](product-research-next.en.md). That note does not change decisions already recorded here, and it does not relist implemented culling, detail, or RAW preview work as unfinished. If the two conflict, the confirmed decisions in this document and in the requirements win.

A research note on connecting the Canon camera used by a beta photographer was written the same day. See [canon-connection-research.en.md](canon-connection-research.en.md). It does not change the intended user here: this application still targets the Ricoh GR IIIx, and the Canon part only discusses whether to integrate it at all and which CR3 and protocol gaps exist today.
