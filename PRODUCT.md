# Product

<!-- impeccable:product-schema 1 -->

## Platform

macos

Impeccable’s documented platform values are `web`, `ios`, `android`, and `adaptive`. This product is a native macOS application built with Native Shell (NSH) 0.5.1. It is not a web app and it does not adapt a mobile design language per operating system. Native Impeccable audit guidance that targets iOS or Android does not apply as a literal checklist.

## Stack

The application is a mixed NSH 0.5.1 project: TSX for the user interface and Rust native modules for configuration, the read-only camera HTTP client, and import. The development bundle identifier is `com.yunkou.ricoh-mac`. That identifier is not a final public identity. The public application name is not decided.

## Users

The primary user is the owner of a Ricoh GR IIIx, using a Mac to import photographs over the camera’s Wi-Fi and to browse them in a local album. Version 1 is for personal use. After a camera profile is saved, Connect Camera switches the Mac to the camera network automatically. While the Mac is on that network, Ethernet or iPhone USB tethering can keep internet access.

## Product Purpose

The application connects to a GR IIIx, switching to a saved camera Wi-Fi profile when one exists, lists photographs on the camera, and imports selected or all files into one local save location, keeping original file names. The user can then browse those files in a local album, open a full-page photograph detail view, and read photographer information. The local album supports 1 to 5 stars, plus picked and rejected flags, persisted next to the photograph and in a local index. On the detail page, a local DNG can be developed from sensor data into a display raster, distinct from an embedded preview and from the original photograph pixels. Success in the current work means the user can choose a save location, see a truthful connection state, browse and import camera photographs, review imported photographs in the album and on the detail page, including a labeled RAW develop when one is available, and star or flag those photographs, and copy every picked original and any existing XMP sidecar into a chosen folder, without changing anything on the camera or overwriting complete local originals.

## Positioning

The product is a Mac desktop import and culling tool for the GR IIIx. Official Image Sync is phone-oriented. This application is built around a single save location, original file names, a photograph-led dark workspace, and a read-only camera relationship.

## Operating Context

The user turns on the camera wireless LAN. On first connection the app saves the camera’s identity and Wi-Fi credentials (the password goes in the macOS Keychain). Later, Connect Camera switches to that network, waits for the camera, and loads photographs. After import, it switches back to the previous network by default. The default camera HTTP origin is `http://192.168.0.1` and can be changed for development or an unusual address. A local mock camera at `http://127.0.0.1:8080` exists for development. Hardware validation of community-documented camera HTTP APIs remains open even after a successful user-reported connect, list, and download session. Original camera photographs are read-only. Tests must not use the user’s real album or real configuration as fixtures.

## Capabilities and Constraints

Confirmed in Milestone 1:

- The user chooses a save location on first launch. The path is stored in the application data directory and can be changed later.
- Connection uses read-only `GET /v1/ping` and `GET /v1/props`. A successful probe automatically loads the photograph list through `GET /v1/photos`. Thumbnails use `size=thumb` when the camera serves them, and are cached under the application data directory.
- Import writes into the single save location, keeps original names, uses a `.partial` temporary file, skips name-and-size matches, reports same-name size conflicts without overwriting, and continues after a per-file error. After an import finishes, the current session keeps a list of failed files so the user can retry only those failures, not files that already succeeded. A retry starts that file over and does not resume mid-file. Partial retry failures show success and failure counts and reasons, and successful retries are removed from the list. The app does not delete, rename, or rewrite files on the camera.
- The interface is fixed dark, uses concise Chinese copy, has no product-name header, and has no persistent sidebar. A circular icon in the corner opens settings only (save location, camera network profile, and camera address). Photographs occupy a virtualized thumbnail grid.
- Primary import is “import selected.” “Import all” is secondary. In 设备, the keyboard shortcuts are Command-A (select all), Escape (clear selection or close settings), Command-Return (import selected), and Command-R (refresh the camera list). These shortcuts do not intercept text entry. Shift-click range selection uses NSH `PressEvent` modifiers.
- Version 1 switches Wi-Fi automatically using a saved camera profile. The password is stored in the macOS Keychain. Location Services may be requested once so the app can read the current network name; if permission is denied, the user types the name shown on the camera. Automatic switching falls back to manual-join guidance on failure. If a proxy is intercepting the camera network, the interface shows a hint.

Confirmed in Milestone 2:

- On launch, the app shows two feature entries, 照片 and 设备. A compact segmented control switches between those areas, and a back control returns to the home screen.
- 照片 lists photograph files already in the single save location as a thumbnail grid, without a camera connection. Opening a photograph, with a click or with Space or Enter, enters a full-page detail view, not a popup. Back or Esc returns to the album grid and keeps that photograph visible. Previous, next, and the related shortcuts stay on the detail page.
- The detail page has a right-hand photographer information panel (exposure first, then lens and crop, Image Control, Snap, ND, capture time, file information, color space, GPS when present, and a histogram). I shows or hides the panel. The panel omits missing fields and does not show the absolute file path.
- JPEG files display in the grid and on the detail page. When a DNG contains an embedded JPEG preview, the album grid and the detail page can show that preview. The detail page labels it as a preview, not as original pixels. A file without a usable preview uses a placeholder in the grid and an explanation on the detail page. Histogram values taken from a preview are labeled as such. Original photographs are only read. The album grid does not decode sensor-level RAW data.

Milestone 3:

- Each imported photograph can have a rating of 1 to 5 stars, or remain unrated, and a single flag: picked, rejected, or none. Picked and rejected are mutually exclusive; the star rating is independent of the flag.
- The album grid and the photo detail page show the same marks, and both offer pointer editing. The album can be filtered by flag or by star rating.
- In Photos and on the detail page, when a photograph is focused or viewed and text is not being edited, `0`–`5` set the rating (`0` clears it; pressing the same star again also clears it), `P` toggles picked, `X` toggles rejected, and `U` clears the flag only.
- In the album list, the user can select several photographs and apply a star rating or a picked or rejected flag to the selection at once. A click still opens the detail page. Command-click adds or removes a photograph, Shift-click selects a range, and Select All is also available. Batch saves reuse the single-photograph write path. A partial failure reports success and failure counts and reasons, and successful photographs remain saved. Photographs that already have the requested marks are left unchanged.
- Marks persist in an XMP sidecar next to the photograph and in a local SQLite index. Original JPEG and DNG bytes are not rewritten, and marks are not written back to the camera.

Confirmed in Milestone 4:

- On the detail page, a local DNG can be developed from sensor data through macOS Core Image `CIRAWFilter.outputImage`. The result is a display raster with a long-edge cap of 4096. It is not an upgrade of the embedded JPEG, and it is not the original photograph at 100%. The page labels a RAW develop and an embedded preview as such. While the develop is running, an existing embedded preview stays visible; on failure the page falls back to that preview and names the source. The histogram is computed from the same developed JPEG and is labeled as a rendered-image histogram, not as a linear sensor histogram. The album grid still does not decode sensor-level RAW data; it uses an embedded JPEG preview when one exists.
- The detail page can toggle between fitting the current display image to the window and showing it at display-pixel size. For an original JPEG, that mode is the photograph itself and is labeled 原片 1:1. For a RAW develop or an embedded preview, the control is labeled 显示尺寸. When photograph size and display size differ, the information panel lists both.

Also implemented: copy every picked original in the album, plus any existing XMP sidecar, into a folder the user chooses. Same-named destination files are left unchanged, source files are not rewritten, the current album filter does not reduce the set, and the destination folder can be opened afterwards. This is not editor integration, and it does not change the existing XMP naming.

Out of scope for the current milestones, and still planned for later milestones: AI-assisted culling. Developer ID signing, notarization, and installer distribution are outside version 1.

Undecided: the public application name and final bundle identifier; whether the application should carry a LICENSE file; whether the icon accents should be more saturated; remaining camera HTTP details listed for hardware validation in the requirements document.

## Brand Commitments

- Fixed dark appearance.
- No product-name header in the interface.
- No persistent sidebar.
- The circular icon is a settings entry only, not primary navigation.
- Warm amber is the accent, reserved for the primary action, selection, and focus.
- Interface copy is concise Chinese.
- Design work follows the Impeccable method in Operate mode: the photograph grid leads, familiar controls, restrained color, and visible state.

## Evidence on Hand

- Product requirements and technical design live in `docs/requirements.zh-CN.md`, `docs/requirements.en.md`, `docs/tech-stack.zh-CN.md`, and `docs/tech-stack.en.md`.
- Milestone 1 camera client, importer, and mock fixture live in `src/`.
- A user-reported session on a real GR IIIx confirmed that connect, listing, and download succeeded in Milestone 1. That report is not a complete hardware validation of every open camera API question.
- This record must not invent testimonials, marketing screenshots, or camera protocol claims beyond sourced documentation and that user report.

## Product Principles

- The photograph is the work. Chrome recedes; the thumbnail grid is the main surface.
- Tell the truth about state. Idle is not an error. A failed connection is not a successful empty list. Skip, conflict, and error are distinct.
- Never modify camera originals, and never overwrite a complete local original.
- Prefer familiar desktop patterns over invented navigation.
- Keep version 1 personal, local, and conservative about signing and distribution.

## Accessibility & Inclusion

Milestone 1 requires visible keyboard focus, text or another non-color cue for status, and contrast that meets WCAG AA for body text (4.5:1) and for controls and focus indicators (3:1). The interface is Chinese. Localization into other languages is not a current requirement. A formal accessibility audit standard beyond these rules has not been adopted.
