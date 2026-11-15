# Next features

This document lists work that has already been decided or recorded in the requirements and plans, and recommends an order. It does not introduce features that were never asked for or planned.

## Publish to the remote repository

On the M6 computer, run `gh auth refresh -s workflow` with the Yunkou account. After that authorization, push the two commits on local `main` to `origin/main`. Those commits are the release-workflow cache and parallel split, and the photo detail page with the photographer information panel. This step does not create a tag and does not publish a release. Pushing workflow files requires the `workflow` scope.

## Next implementation

The recommended order is as follows. The first two items are needed for the next release and for the quality of work already implemented. The items after that continue the version 1 milestones.

1. **Product-style release notes, starting from the next version.** Follow [release-notes.en.md](release-notes.en.md) and change the release workflow so that it reads the matching bilingual notes under `docs/releases/`, then appends the install steps and the checksum section. The install steps are: unzip, drag into Applications, then Control-click and choose Open. The checksum comes last. The release job should fail if the notes file for that version is missing. Do not rewrite the published v0.2.0 GitHub Release page. Keep `docs/releases/v0.2.0.zh-CN.md` and `docs/releases/v0.2.0.en.md` as the template for later versions. This item comes first because the next tagged release needs the new page format.

2. **Confirm Ricoh MakerNotes against real GR IIIx files.** Image Control, crop (40 mm when off, 50 mm or 71 mm when cropped, never the GR III values 35 mm or 47 mm), Snap, Full Press Snap, the ND filter, and color temperature must be checked against real JPEG and DNG files before the displayed labels are treated as final. The current parser follows public tag descriptions and synthetic fixtures. This item follows the existing detail page. It confirms work already implemented; it is not a new feature.

3. **DNG preview in the album grid.** Implemented. The album grid reuses the detail page’s read-only extraction: when an embedded JPEG preview is present, the cell shows that thumbnail from `preview-cache`; when the preview is missing or unusable, the cell uses the existing “cannot preview” placeholder. The original file is not written back. This is not a sensor-level RAW decode.

4. **Culling: 1 to 5 stars, plus picked and rejected.** Implemented. This is Milestone 3 in the requirements. A photograph can have 1 to 5 stars or remain unrated, and a single flag: picked, rejected, or none. Picked and rejected are mutually exclusive; the star rating is independent of the flag. The album grid and the photo detail page show the same marks and both offer pointer editing. Shortcuts, active in Photos and the detail page when a photograph is focused or viewed, and only when not editing text, are: `0`–`5` set the rating (`0` clears it; pressing the same star again also clears it), `P` toggles picked, `X` toggles rejected, and `U` clears the flag only. The album can be filtered by flag or by star rating.

   Marks are written to a canonical XMP sidecar named `{file_name}.xmp`, including the photograph's extension, for example `R0001234.JPG.xmp` and `R0001234.DNG.xmp`. A same-stem JPEG/DNG pair therefore keeps two sidecars, and a write never overwrites the other photograph's marks. A `{stem}.xmp` file such as `R0001234.xmp` is read only when no sibling in the folder shares that stem; writes always go to the canonical path and leave `{stem}.xmp` untouched. The rating is stored as `xmp:Rating` with values 0 to 5. A value of `-1` (Adobe's rejected rating) is read as unrated and is not written, so reject is not coupled to the star value. The flag is stored as `ricohMac:Flag` (`picked` or `rejected`) in the namespace `http://ns.yunkou.ricoh-mac/1.0/`; the attribute is omitted when the flag is none. Unknown XMP fields and namespaces are kept. A corrupt existing sidecar is left unchanged and reported as an error. Writes are atomic (a hidden `.name.{pid}.partial` file renamed into place). Path names are rejected when they would traverse, and documents that contain `<!DOCTYPE>` or `<!ENTITY>` are rejected.

   The same marks are mirrored into a rebuildable SQLite index under `data_dir()/cull-index.sqlite`, keyed by the canonical library path and file name. The sidecar is the source of truth. If the sidecar is missing, a previous index row may be shown. If the sidecar write fails, the index is not updated and the UI does not treat the change as saved. If the sidecar write succeeds and the index then fails, the error is still returned so a later load can rebuild the index. Original JPEG and DNG bytes are never written, and marks are not written back to the camera.

## Later milestones

- **Sensor-level RAW / DNG preview and histogram.** A view and histogram computed from sensor data are outside the current photographer information panel. The decoder and its license are a separate decision, listed below.
- **How version 1 meets the RAW preview requirement if wireless transfer cannot deliver DNG.** This remains in the hardware-validation list in the requirements document, and will be decided after a real-camera test.
- **An application LICENSE file.** The repository already ships license texts for the font and the icons. The application itself does not yet include a LICENSE file.
- **The public application name and the final bundle identifier.** The current development identifier is `com.yunkou.ricoh-mac`. It is not the final identity.
- **More saturated icon accents.** Change these only if there is a clear request for it.

## Still-open decisions

- Whether a later sensor-level DNG preview or histogram should accept rawler's LGPL-2.1 license, or use ImageIO or another decoder after a license review. This document does not choose between those options.
- The public application name and the final bundle identifier.
- Whether the release title should be “Ricoh Mac”, or should keep the current application file name.
- Whether the release notes should keep a commit-comparison link at the end.
- Whether the icon accents should be more saturated.
- Whether the application should include a LICENSE file.

The remaining camera HTTP items in section 9 of the requirements document still need hardware validation. They are not expanded here as product features.
