# Product research and a plan for what to do next

This note is based on public sources consulted on 16 November 2026 (Asia/Shanghai), read against the capabilities already present in this repository at `v0.3.1` (commit `7716f93`) and the gaps that are still unverified. It is a planning recommendation, not an implementation plan, and it does not promise a schedule. It does not change decisions already recorded in [next-features.en.md](next-features.en.md) or in the requirements documents. If the two conflict, those confirmed decisions win.

Quoted phrases are short and taken from the cited pages. The access date is 16 November 2026 unless a page itself states a publication or update date. Some vendor help pages returned HTTP 403 to a simple fetch; their body was still read on the same day, so they are access-limited, not missing. No current product named GR2DNG was found, so it is not listed.

## Positioning, intended user, and hypotheses still to verify

This application is for a person who owns a Ricoh GR IIIx and reviews photographs on a Mac. Official wireless tools are aimed at smartphones, not at the desktop. The product’s place is: after the camera’s Wi-Fi is on, bring photographs reliably into one local save location, browse and cull them in the album, then hand the selects to an editor the user already has. Version 1 remains personal use, not a studio-scale culling platform.

These hypotheses would change what comes next, but they are not proven facts:

- What actually blocks the user is getting complete originals, especially DNG, onto the Mac in a stable way, not the absence of AI auto-culling.
- After culling, the user wants selected photographs and star ratings to reach Lightroom Classic, Capture One, or at least a folder. The preferred editor has not been confirmed with the user.
- On the user’s current firmware, a full-file download without a size parameter can include a complete DNG. The requirements document already says official Image Sync wording cannot answer this; only a real-camera test can.
- This application writes sidecars as `{file_name}.xmp` including the original extension, such as `R0001234.DNG.xmp`, so a same-named JPEG and DNG each keep their own marks. Lightroom and Capture One more often share one `R0001234.xmp` for the same stem. Whether they pick up this application’s files automatically is still untested.

## Evidence matrix

| Source | Capability or pain | Why it matters here | Strength |
| --- | --- | --- | --- |
| [Ricoh application list](https://www.ricoh-imaging.co.jp/english/products/app/) | GR WORLD and Image Sync are listed for iOS and Android. Official wording for GR WORLD is that you use it “by connecting a RICOH GR-series camera to a smart device with the app installed.” Image Sync is described as “copying image to a mobile device.” Official GR Remote supports only the GR II; it is not a desktop tool for the GR III or GR IIIx. | Ricoh does not offer a Mac wireless-import application on a par with Image Sync. This product fills that desktop gap; it should not try to become another phone app. | Strong (official product page; Image Sync OS support still listed as of May 2026) |
| [GR III / GR IIIx usability](https://www.ricoh-imaging.co.jp/english/products/gr-3/feature/04.html) | You can “connect to a smartphone, use the exclusive app to transfer images.” The same page also says USB Type-C can connect the camera to a PC to charge and transfer data. | The officially acknowledged computer path is a cable; wireless is written as a smartphone path. Desktop wireless import remains this product’s difference, but cable import must not be described as if it did not exist. | Strong (official product page) |
| [GR WORLD FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-world/) | Supports the GR III and GR IIIx. The feature table ticks WLAN connection, image import, in-camera transfer reservation, and remote capture for those bodies. | Official follow-on apps remain phone-first and include remote capture. Remote capture is outside version 1 of this application, and should not become the next step only because the official phone app has it. | Strong (official FAQ) |
| [Image Sync product page](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/) | Supported models include RICOH GR III and RICOH GR IIIx. As of May 2026, the recommended environment is iOS 16–18 and 26, and Android 13–16. V2.1.32 was released on 21 May 2026. | Ricoh still maintains the phone app, and does not list macOS or Windows as supported systems. | Strong (official product page) |
| [ZAKAZUKURI tutorial](https://zakazukuri.com/ricoh-digital-camera-gr-iii-wifi-photo-transfer/), published 2 May 2020, updated 4 June 2023 | The author writes: 「电脑だと似たような方法はありませんよね」 (there is no similar method on a computer). Commenters reported, on 13 October 2021 and 24 February 2023, using a script on a Mac to copy GR IIIx photographs over Wi-Fi. | These are first-hand signals with dates: people wanted to copy photographs from a GR IIIx to a Mac, and accepted a script because no official desktop app exists. A few comments are not a market-size claim. | Medium (independent tutorial and signed comments, not official) |
| [GRsync-GR3-HDF](https://github.com/no-ra-inu/GRsync-GR3-HDF) | A public Python script that can transfer photographs from the GR II, GR III, GR IIIx, and their HDF variants to Windows or Mac over Wi-Fi. On 2 January 2026 the author pointed to this repository in a comment on the tutorial above. | Desktop wireless import is still being maintained, but as a script, not as a browse-and-cull application. If this product makes connect and import reliable, it sits on the same need. | Medium (public repository and author comment) |
| [Remote for Ricoh GR and Pentax](https://apps.microsoft.com/detail/9MXVP8F327FN) in the Microsoft Store | The page title indicates a third-party Windows app for remote control and download. A simple fetch returned 403, so body detail is limited. | A third-party desktop tool exists on Windows. It is not official, and it is not a Mac app. It is not a model this project should copy. | Weak to medium (store page exists; body access-limited) |
| [Photo Mechanic tour](https://home.camerabits.com/tour-photo-mechanic/) | “Plug in a memory card and almost immediately start choosing the photos to keep and those to delete.” It supports browsing and tagging during ingest, comparing photographs side by side, and a path to “bring only those selects into your post-processing workflow.” | This is the standard for fast culling after card ingest, not a camera Wi-Fi tool. What is useful here is “cull, then hand off to the editor,” plus side-by-side compare. Multi-card ingest and stock delivery should not become the next step. | Strong (vendor product page) |
| [FastRawViewer](https://www.fastrawviewer.com/) | It emphasizes viewing RAW on the fly rather than only the embedded JPEG; it offers focus peaking, a RAW histogram, ratings and labels written to XMP “so that they will be read and applied by RAW converters that support them,” and a way to “run in an external program” or to move or copy files. It can compare two or four photographs. | This is a reference for the detail preview and histogram already in this application, not a list of missing features. The useful lessons are: judge quality from RAW, write marks that an editor can read, and hand selects to an external program. Side-by-side compare and 100% focus checks are later candidates, not the weakest link now. | Strong (vendor product page) |
| [Narrative Select](https://narrative.so/select) | An AI-assisted culling tool that advertises sending selects to a post-processing application, and can also copy or move selects into a folder. | “Send to the editor” is a common way to close the loop. AI auto-culling is aimed at high-volume portrait or event work, and should not be assumed as this application’s next step. | Strong (vendor product page, for capability); marketing numbers are not used as facts |
| [Aftershoot](https://aftershoot.com/) | An AI culling, editing, and delivery platform for working photographers. Its documentation says the workflow is non-destructive, and that ratings in a RAW workflow are typically written to an XMP sidecar rather than into the source file. | XMP and leaving originals untouched already match this application’s approach. The product serves high-volume commercial work; it does not prove this application needs AI culling now. | Strong (vendor product page); claims such as hours saved per month are not adopted |
| [Lightroom Classic: saving metadata to XMP](https://helpx.adobe.com/lightroom-classic/desktop/organize-photos-in-lightroom-classic/create-xmp-acr-files.html), page marked updated 27 October 2025 | Lightroom can turn on “Automatically write changes into XMP,” or use “Save Metadata to File,” and write a sidecar beside the photograph. | Lightroom uses sidecars to exchange metadata with other tools. This application already writes `xmp:Rating`. Opening this application’s files in Lightroom has not been tested. The help page returned 403 to a simple fetch; the body was read. | Strong (official help, that Lightroom writes sidecars); medium (whether this application’s file names are recognized, still untested) |
| [Capture One: metadata in XMP sidecar files](https://support.captureone.com/hc/en-us/articles/360002544898-Metadata-in-XMP-sidecar-files), page marked updated 16 March 2025 | “Please note that there would be the same XMP file for the images with the same name but with different extensions. For example, ImageName001.NEF and ImageName001.jpg will have the same XMP file ImageName001.XMP.” Capture One does not write metadata into source files. The help page returned 403 to a simple fetch; the body was read. | This conflicts directly with this application writing one extension-qualified sidecar per JPEG and one per DNG. If the next destination is Capture One, the limit must be documented, or a compatibility strategy added that does not break the existing paired-file semantics. | Strong (official help) |
| [Camera Bits forum: Photo Mechanic ratings and Lightroom](https://forums.camerabits.com/index.php?topic=15574.0) | Support notes that Photo Mechanic writes ratings to sidecars, with `xmp:Rating` visible in the text, and that Lightroom Classic should read them in the Library, though the Import window may not show them. Already-imported photographs may need “Read Metadata from File.” On a case-sensitive volume, sidecar extension case can also cause a miss. | Even when both sides write `xmp:Rating`, file names, case, and when metadata is read can still hide stars. Hand-off to Lightroom needs a test with this application’s real files, not an assumption of compatibility. | Medium (vendor support note, not a lab report) |

Not listed: official GR Remote, which is a smart-device app for the GR II only; and GR2DNG, which was not found as a current product.

## Current gaps

Keep “already implemented,” “implemented in software but not yet accepted on a real camera or in a real window,” and “not yet offered as a product capability” separate. Stars, flags, filters, the detail view, RAW develop preview, and the histogram must not be restated as unimplemented features.

Already present in `v0.3.1`, and to be treated as existing capabilities: choosing a save location; saving a camera profile and automatically switching or restoring Wi-Fi, with a manual fallback; listing and importing camera photographs, using a temporary file, skipping the same name and size, and reporting a conflict when the name matches but the size does not; a local album grid and a full-page detail view; DNG embedded previews and a RAW develop display raster with a 4096 long-edge cap; one-to-five stars, picked and rejected flags, filters, and the canonical XMP sidecars plus index; and the `v0.3.1` album and detail layout.

Implemented, but still not claimable as accepted:

- Real-camera Wi-Fi and wireless DNG transfer. Section 9 of the requirements document is still open, including the address and probes, the shape of the photo list, preview size parameters, whether a download without `size` is a complete DNG, whether official-app pairing is required, and stability with large files or a weak signal. The repository has recorded a user report of a successful connect, list, and download. That does not replace a check against section 9.
- Resume after an interrupted import. The requirements say import should resume from a breakpoint or after a fresh integrity check. A headless test covers incomplete-download recovery against a local simulated HTTP server. That is not a substitute for interrupting a large file on a real camera.
- Visual acceptance of the `v0.3.1` layout in a real window, including whether colour and display are acceptable. Headless tests cannot replace a look at the actual window.
- Remaining MakerNote items. Public samples already cover some fields. Crop 50 mm and 71 mm, Snap, Full Press Snap, ND On, Kelvin white balance, and other Image Control settings are still uncovered by real photographs; see [gr-iiix-makernote-verification.en.md](gr-iiix-makernote-verification.en.md).
- Whether stars remain visible after the files reach Lightroom or Capture One. Writing `xmp:Rating` is implemented; whether those editors recognize this application’s file names is unverified.

Not yet offered as product capabilities, and relevant to a public workflow:

- Copying, moving, or revealing selected photographs (or a chosen star rating) and handing them to an external editor.
- Showing RAW and JPEG as a pair in the interface. They are currently two side-by-side files, each with its own sidecar.
- Grouping imports by shoot date or session. Version 1 already decided to import into one folder and keep original file names.
- Comparing consecutive similar photographs side by side, and RAW focus peaking or a 100% check that is not limited by the 4096 long-edge cap.
- A multi-step undo stack for culling. The keyboard can toggle marks again, but there is no dedicated undo history.
- Developer ID signing and notarization, the public name, and an application LICENSE. These remain release-identity questions, not culling features.

## Priorities and a will-not-do list

The core loop that most deserves investment is reliability of connect and complete import, then a way to send cull results out of the application. Official tools leave wireless to the phone and computer transfer to a cable. In public discussion, people who want GR IIIx photographs on a computer look for a desktop method. Stars, filters, and the detail preview already exist in the album. If connect, complete DNG, and interrupted-import recovery have not been proven on a real camera, adding a compare view or AI culling still will not finish “bring the shoot back to the Mac.”

Suggested priorities:

1. Run a recorded real-camera validation against section 9 of the requirements, especially complete DNG, network switch and restore, and an interrupted large-file import.
2. Patch connect and import gaps that validation exposes, before adding more browsing features.
3. Look at the `v0.3.1` album and detail layout in a real window.
4. Test star ratings from this application’s sidecars in the user’s target editor, and document the limits honestly.
5. After those interoperability limits are clear, provide an “export or reveal selects” exit.

Suggested to defer, or to treat as not next:

- AI auto-culling or automatic grouping. Narrative and Aftershoot serve high-volume commercial work, which is not the weakest link in this personal GR workflow. The requirements already list AI-assisted culling as a later candidate; this note does not pull it forward.
- Remote capture, writing back to the camera, or calling transfer-reservation interfaces that change camera state.
- Turning this application into a second Lightroom or Capture One.
- A separate product line for the GR IV. Official phone apps already cover that body; this repository’s subject remains the GR IIIx.
- Auto-creating date subfolders at import. That conflicts with the version-1 decision to use one folder and keep original names, unless the user explicitly reverses that decision.
- Building side-by-side compare or focus peaking first, so the application “looks more like a culling tool.” Those features have value after the core loop is proven.

## A suggested split of the next one or two versions

Version numbers here only divide the work. They are not a promise of a release date or of effort. If real-camera results are worse or better, the slices can be merged or split.

**Do a “stabilize and prove” slice first (for example v0.3.2).** The aim is not a feature announcement. It is to make the already promised connect, import, and browse path stand up on a real camera and in a real window. That includes completing the section 9 list and recording the results; patching defects found in resume, integrity checks, network restore, or DNG download; visually checking the `v0.3.1` layout; and writing a short note on how to keep using a memory card or USB to place DNG in the same save location if wireless DNG is unavailable (any product decision on that path still waits for the real-camera test, as the requirements already say). If there is room, run a Lightroom or Capture One read of the existing sidecars and record it, without changing the write format first.

**Close the workflow loop only after that evidence (for example v0.4.0).** After the stability slice, send selected photographs out of the application: copy or reveal the selects, and only then improve sidecar correspondence with a common editor if the experiment shows it is needed, without breaking the already decided rule that a same-named JPEG and DNG each keep their own marks. Optional, and lower priority: a pair hint for RAW and JPEG in the grid, side-by-side compare, and a better focus check. Do not put AI culling in this slice.

## User stories, acceptance, dependencies, and risks

**Story 1: Prove connect and import on the user’s own GR IIIx.** As the user, I turn on camera Wi-Fi, connect with a saved profile, and see a real success or failure, not an unverified “connected” state. I can import JPEG, and I can import a complete DNG when wireless can provide one. After import, the network is restored as promised. Acceptance: record requests, responses, and file results against section 9 of the requirements. If a download without `size` is claimed to be DNG, the file must open as DNG and match the camera’s size information. If network restore fails, only the designed fallback appears. Dependencies: the user’s camera, current firmware, and a session that a test fixture cannot replace. Risk: if wireless cannot deliver DNG, the version-1 RAW preview strategy must be decided after the test, as the requirements already require; a JPEG must not be described as RAW.

**Story 2: An interrupted import can continue safely.** As the user, I interrupt a larger file halfway, import the same file again, and do not get a truncated file treated as complete, and do not overwrite a complete file that is already the same. Acceptance: after the second import, the final file is complete; a finished identical file is skipped; a same name with different content still reports a conflict. Dependencies: the real-camera setup from story 1, or at least one real large file. Risk: a pass against simulated HTTP must not be written up as camera-verified.

**Story 3: Hand selects to an editor or a folder.** As the user, after filtering to picked photographs or to a star rating, I can copy those files to a folder or reveal them in Finder, so I can open them in Lightroom, Capture One, or another tool. Acceptance: only the user-specified set is handled; original pixels are not rewritten; the copy step says which sidecars go with the files. Dependencies: story 1 is not a hard prerequisite, but the exit is less useful if the album does not yet hold reliable originals. Risk: the user may expect “export” to rename files, build date folders, or write into an editor catalog. The behaviour has to be stated clearly.

**Story 4: Stars are visible in the target editor, or the limit is documented.** As the user, I want to see stars written by this application in Lightroom Classic or Capture One. Acceptance: run one read experiment with a JPEG and DNG pair and their sidecars from this application. If the editor shows `xmp:Rating`, record the steps required, such as reading metadata from the file. If it does not, document whether the issue is the file-name convention or the mark field, and assess the effect on paired files before changing the write format. Dependencies: confirmation of which editor the user actually uses. Risk: Capture One explicitly shares one sidecar across the same stem, which conflicts with the current design. Marks for two originals must not be silently merged into one file for the sake of compatibility.

**Story 5: Confirm the album and detail views in a real window.** As the user, I browse the album, open a photograph, switch info, and set stars at my own window width, without controls taking the photograph away or existing shortcuts disappearing. Acceptance: look at the window near 720 pt and 900 pt, and at a narrower width; check the top-bar drag region, filter menu, info overlay, and tool strip. Dependencies: opening installed or `nsh dev` `v0.3.1` on this Mac. Risk: a headless pass cannot replace this check.

## Minimal real-camera validation list

One recorded session should cover these items first. The list should not grow just for this plan.

1. On the current firmware, whether the camera access point answers `GET /v1/ping` and `GET /v1/props` at `192.168.0.1:80`.
2. Whether `GET /v1/photos` returns a complete list, or is truncated.
3. Whether a full-file download without `size` yields a complete DNG, and whether DNG appears in the list. Compare the file size with the original on the camera or card, and confirm that the file opens.
4. Automatic switching to the camera network, and restoring the previous network after import; whether the designed explanation appears on failure.
5. Interrupting a larger import and importing the same file again, checking that a truncated file is not treated as complete.
6. Skipping a file with the same name and size; reporting a conflict, and not overwriting, when the name matches but the size does not.
7. If an interoperability experiment is included: opening `xmp:Rating` written by this application in the target editor.

A specific wireless speed is not an acceptance condition for this minimal list. The requirements already note that community reports mention 2.4 GHz and slower thumbnails; actual rates must be measured on a real camera. This note invents no numbers.

## Recommendation and a short list of open questions

The recommended next step is to stabilize and prove the existing path, not to add more culling interface or AI. The first concrete action is a real-camera session on the user’s own GR IIIx, recorded against the minimal list above. Without that record, connect and wireless DNG should not be described as accepted, and the main effort should not move to side-by-side compare or auto-culling.

Only a few questions need confirmation, and they do not block that recommendation:

1. After culling, do you most often hand photographs to Lightroom Classic, Capture One, or only a folder? That choice sets the interoperability experiment in the loop-closing slice.
2. In the next real-camera session, can you include at least one complete wireless DNG download and one interrupted large-file retry?
3. Have you already looked at the `v0.3.1` album and detail views in a real window, and is there a visual issue that has to be fixed first?

The public application name and the final bundle identifier remain open items in [next-features.en.md](next-features.en.md). This note does not reopen them.
