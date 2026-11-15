# Product requirements

Repository: <https://github.com/Yunkou/ricoh-mac>
Companion design: [tech-stack.en.md](tech-stack.en.md)
Chinese version: [requirements.zh-CN.md](requirements.zh-CN.md)

---

## 1. Background and goals

The Ricoh GR IIIx stores photos on the camera or an SD card. Official wireless transfer is aimed at the Image Sync app on a smartphone, not at a Mac desktop workflow. This project is a Mac app that connects after the camera's Wi-Fi is on, browses and imports photos, supports fast culling in a local album, and previews RAW (DNG) files.

Version 1 covers only this path: camera to this Mac, then culling on this Mac. AI-assisted culling is out of version 1.

---

## 2. Users and scenarios

**Primary user:** A photographer or enthusiast who shoots with a Ricoh GR IIIx, organizes photos on a Mac, and wants fewer card swaps and less dependence on a phone app.

Typical scenarios:

- After a shoot, the user turns on the camera Wi-Fi, reviews thumbnails on the Mac, and imports chosen JPEG or DNG files into a local album.
- With no camera and no network, the user opens an already imported album, browses quickly, applies stars or flags, and opens a RAW preview.
- After a dropped transfer, the user reconnects. The app should resume unfinished downloads and must not rewrite files that already arrived complete.

---

## 3. In scope and out of scope

### 3.1 Version 1 must include

- Connect to the camera over Wi-Fi.
- Browse and import photos that are on the camera.
- Browse a local album.
- Fast culling with stars or flags.
- RAW / DNG preview.

### 3.2 Version 1 does not include

- AI-assisted culling (a later-version candidate).
- Support for other camera brands.
- Automatic deletion, overwrite, or rewriting of files on the camera, or of pixel data in imported originals.
- Retouching, full RAW develop-and-export, cloud sync, or social sharing.
- Remote shutter, live view, or changing camera settings (version 1 does not need capture control).
- Waking the camera over Bluetooth.
- Distributing installers, Developer ID signing, and notarization. Version 1 is for personal use only.

### 3.3 Safety boundary

In version 1, camera access is limited to read-style probes and downloads. The app must not call endpoints that power off the camera, disable Wi-Fi, fire the shutter, or change settings. Those endpoints are out of scope for version 1. Adding them later would require a scope change and hardware validation.

---

## 4. Functional requirements

Each item has a user story and acceptance criteria. Clauses that depend on the camera's wireless behavior are based on public sources and are subject to hardware validation.

### 4.1 Connect to the camera over Wi-Fi

**User story:** As a user, I open 设备, see the saved camera profiles, and after I turn on the camera Wi-Fi I can connect from a profile, join the saved camera network, probe the camera, and see whether the connection succeeded, failed, or still needs a profile.

**Decision:** Version 1 saves a camera profile on first connection (model, serial, and firmware when available, plus the camera Wi-Fi SSID) and stores the Wi-Fi password in the macOS Keychain, never in a plaintext config file. Later, Connect Camera switches the Mac to that SSID, waits for `192.168.0.1`, then probes and loads photographs. The app remembers the previous network and, by default, switches back after import or when the user disconnects, and also offers a clear switch-back action in the interface. This supersedes the earlier decision that version 1 would only support joining the camera Wi-Fi by hand. If automatic switching fails, the app falls back to manual-join guidance.

**Acceptance criteria:**

- The app gives clear steps: turn on the camera wireless LAN. If no profile is saved yet, the user can enter the SSID and password shown on the camera LCD (the official [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html) says the password can be displayed on the camera LCD; the exact camera menu follows the [operating manual](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf)). If the Mac is already on the camera network, the app captures the current SSID when permission allows and asks only for the password.
- After a profile is saved, Connect Camera switches to the saved SSID, waits for the camera at `192.168.0.1`, then probes reachability with read-only requests and shows success, failure, or timeout. It must not present an unverified state as connected.
- The password is stored only in the macOS Keychain. Profile metadata is stored in the application data directory. 设备 lists saved camera profiles and can connect from a chosen profile. The settings panel can edit or delete the current profile.
- On failure, the app shows an understandable reason (wrong password, camera wireless LAN off, timeout, location permission denied, or failed to join) and does not change camera state. If automatic switching fails, it falls back to manual-join guidance.
- After import, the app switches back to the previous network by default, and the interface also offers Switch Back. The user can turn off automatic switch-back.
- If a proxy is intercepting the route to the camera, the interface shows a clear hint that the camera may be unreachable, and asks the user to exclude the camera network from the proxy and try again.
- The app does not require the official Image Sync app to be installed or paired first. Whether official-app or Bluetooth pairing is required is to be validated on hardware.

Public sources (not an official SDK; to be validated on hardware): several independent write-ups say that a GR IIIx in Wi-Fi mode acts as an access point, that an HTTP service listens at `http://192.168.0.1/` on port 80, and that `GET /v1/ping` and `GET /v1/props` are used as read-only probes. Sources: the [secretsauce reverse-engineering note](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html), [Namako's GR3x write-up](https://namako.tw/2024/05/11/gr3x-wireless-api/), the [CursedHardware community OpenAPI](https://github.com/CursedHardware/ricoh-wireless-protocol), and [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app). Ricoh has not published an official HTTP SDK under these names.

### 4.2 Browse and import photos from the camera

**User story:** As a user, after a successful connection I can browse thumbnails of photos on the camera, choose files to import, save complete copies into one local target folder I choose, and resume later if the transfer stops.

**Decision:** Every imported file goes into a single target folder and keeps the camera's original file name. The import still writes a temporary file, validates it, then renames it into place, and it keeps the existing deduplication rules.

**Acceptance criteria:**

- The app can list photos or folders visible on the camera and browse them as thumbnails. When the list is empty, fails, or is truncated, the UI explains why and does not pretend the camera state is fine.
- The user can select several files and import them into one previously chosen target folder. The import shows progress, success, failure, and skips (for example a complete file that already exists).
- The destination path uses the camera's original file name. The app does not create another directory layer by date or by the camera's folder name.
- Imports write to a temporary file in the same folder and move to the final path only after the copy is complete. A later import of the same file should resume or re-validate, and must not overwrite a complete file whose content already matches.
- If two source files would land on the same name in the target folder but their content differs, the app must report a conflict and must not overwrite a complete original that is already there.
- Import must not modify, delete, or move originals on the camera.
- After an import finishes, the interface offers 查看照片, which opens 照片.
- If the camera can serve DNG over the wireless path, version 1 should import DNG. If a real camera can only serve JPEG over Wi-Fi, the app must say so clearly and must not label a JPEG as RAW. If wireless transfer cannot deliver DNG, how version 1 should still meet the RAW preview requirement will be decided after testing on a real camera.

Public sources (to be validated on hardware): community clients commonly use `GET /v1/photos` to list folders and files, `GET /v1/photos/{folder}/{file}` to download the original, `?size=thumb` for a thumbnail, and `GET /v1/photos/{folder}/{file}/info` for metadata. Preview size parameters disagree: Namako records `size=xs` (about 1920×1080), snmkl/ricoh.app records `size=view`, and the community OpenAPI lists `xs`, `view`, and `thumb` with pixel sizes that do not fully match those write-ups. The query parameters and the JSON shape must be checked on a real camera. The community OpenAPI download response includes `image/jpeg` and `image/x-adobe-dng`, which suggests a full-file download may include DNG. Official Image Sync documentation says that resize-before-transfer supports JPEG only. Whether a complete DNG can be transferred over Wi-Fi therefore cannot be settled from official text alone.

### 4.3 Browse a local album

**User story:** As a user, I can open 照片 without connecting a camera, browse thumbnails of files already imported into the save location, open a photo detail page, and move to the previous or next photo.

**Acceptance criteria:**

- 照片 is available from the home screen, from the in-app area switch, and from 查看照片 after an import. It does not require a camera connection or a network.
- The user chooses the album root with the system folder dialog. That folder is also the single import target. The app lists photograph files that sit directly in that folder. It does not descend into subfolders, and it must not scan the system Photos library or other unauthorized paths.
- The interface shows a virtualized thumbnail grid and a photo detail page. A click, Space, or Enter opens the detail page from the grid. After opening a photo, the user can return to the grid with Back or Esc and can move to the previous or next photo in the same folder. The detail page presents photographer information in a side panel.
- JPEG files display in the grid and on the detail page. The album grid does not preview DNG files. When a DNG contains an embedded preview, the detail page can show that preview and labels it as a preview, not as original pixels. A file that cannot be displayed shows an explanation, not an empty frame.
- Browsing is read-only. The app must not create, rewrite, move, or delete original files in the save location.
- After a refresh or after entering 照片 again, files added later inside the agreed scan scope should appear.

### 4.4 Fast culling, stars, or flags

**User story:** As a user, while browsing I can quickly star or flag a photo, later filter by star rating or flag, and find those choices still there the next time I open the app.

**Decision:** Ratings are 1 to 5 stars. There are two flags: picked and rejected. Ratings and flags are written to XMP sidecar files and also kept in a local SQLite index.

**Acceptance criteria:**

- Each photo can have a rating from 1 to 5 stars, or remain unrated.
- The app supports two flags: picked and rejected. A photo may have no flag, or one of the two flags. Picked and rejected are mutually exclusive.
- Stars and flags can be applied with the keyboard or the pointer without breaking the browsing rhythm. Exact keyboard shortcuts are recorded under Open Questions.
- The list can be filtered by star rating or flag.
- Ratings and flags persist: they are written to an XMP sidecar next to the photo and mirrored into a local SQLite index for filtering. Version 1 must not write this data to the camera, and must not rewrite pixel bytes of imported originals. Storage details are in the technical design.
- After a flag is cleared or a star rating changes, the filtered list updates at once, and the sidecar and the index stay in sync.

### 4.5 RAW / DNG preview

**User story:** As a user, I can preview DNG files in the local album (and in the camera list when wireless browsing allows it) without developing them in another app first.

**Acceptance criteria:**

- For a local DNG, the detail page can show an embedded JPEG preview when one is present, not a full demosaic render. The album grid does not yet preview DNG files. The rationale is in the technical design.
- If a DNG has no usable preview, the UI says that it cannot be previewed and still shows basic information such as the file name.
- A failed preview must not damage or rewrite that DNG.
- Thumbnails for DNG files in the camera list depend on what the wireless interface actually returns, and are to be validated on hardware.
- If testing on a real camera shows that DNG cannot be transferred over Wi-Fi, whether version 1 should still meet the RAW preview requirement with DNG files already on disk (for example copied from a memory card into the target folder) will be decided after that test. Until then, the item remains listed under To be validated on hardware.

Official documents confirm that the camera can record DNG, and can record RAW and JPEG together. See the [GR III / GR IIIx FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html) and the [operating manual](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf).

---

## 5. Non-functional requirements

### 5.1 Performance

- A thumbnail grid should stay usable for a typical shoot (target: a local list of at least several hundred photos remains operable). Exact limits will be established from measurements during implementation, and the design must avoid decoding every original at full size at once.
- Community notes say the camera Wi-Fi is 2.4 GHz and that thumbnails can be slow, so the app should lazy-load and cache locally. See [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app). Throughput needs measurement on a real camera.

### 5.2 Offline

- Local browsing, preview, starring, and flagging must work with no camera and no internet.
- Only reachability probes, camera browsing, and import need the camera network. The app must not pretend the camera is connected while offline.

### 5.3 Privacy

- Photos and ratings stay on the user's Mac by default. Version 1 must not upload originals or previews to any service.
- App settings are stored in the data directory the system gives this app, not in unrelated locations outside the user's album tree.
- Version 1 does not send analytics or crash reports off the machine.

### 5.4 Original-file safety

- Do not modify, delete, or move files on the camera.
- Do not rewrite pixel bytes of imported originals (JPEG, DNG, or other original files). Ratings and flags go to XMP sidecars and to the app's SQLite index.
- Do not rename or overwrite a user's complete existing file in the name of organizing.
- Tests must not use the user's real album or real config as fixtures.

### 5.5 Dark appearance

The interface uses a fixed dark appearance. This is a locked version 1 visual decision. The app does not follow the system’s light appearance.

### 5.6 Signing and distribution

**Decision:** Version 1 is for personal use only. Ad hoc signing from `nsh package` is enough. There is no Developer ID signing and no notarization. Distributing an installer is out of scope for version 1.

---

## 6. UX principles

The version 1 interface follows the [Impeccable](https://impeccable.style/) Operate mode and locks the following decisions:

- The whole app uses a fixed dark appearance. The accent is warm amber, reserved for the primary action, selection, and focus.
- Interface copy is concise Chinese.
- There is no product-name header and no persistent sidebar.
- On launch, the app shows two feature entries: 设备 and 照片. Inside an area, a compact segmented control switches between them, and a back control returns to the home screen.
- The circular icon button is a corner settings entry only. It holds the save location control, the camera network profile, and the camera address. It is not primary navigation.
- In 设备, photographs on the camera are shown in a virtualized thumbnail grid. “Import selected” is the primary action. “Import all” is secondary. In 照片, a click or tap opens the photo detail page rather than a selection for import.
- “Not yet connected” is not shown as an error before a connection has been attempted. A successful probe loads the photograph list automatically. Import progress, skips, conflicts, and errors are distinct.

Visual tokens and component rules are in [DESIGN.md](../DESIGN.md).

---

## 7. Milestones

The following is an implementation sequence, not a dated schedule.

1. **M0 Documentation:** Product requirements and technical design.
2. **M1 Library, connection, listing, and import:** Choose and persist the save location; save a camera network profile and later switch Wi-Fi automatically, then probe the camera; list photos; import selected or all files into that folder. Scope and acceptance criteria are in section 11. The interface follows the UX decisions in section 6.
3. **M2 Local album browsing:** Browse thumbnails and a photo detail page of files already in the save location, including use without the camera. This milestone includes the photographer information panel and an embedded DNG preview on the detail page. The album grid still does not preview DNG files.
4. **M3 Culling:** 1 to 5 stars, picked and rejected flags, filters, and persistence in XMP sidecars and SQLite.
5. **M4 RAW preview:** DNG thumbnails in the album grid, and a later sensor-level RAW preview and histogram. DNG in the camera list, and how version 1 meets the preview requirement if wireless transfer cannot deliver DNG, follow real-camera test results.

AI-assisted culling and Bluetooth wake go to later-version candidates.

---

## 8. Open questions

1. What keyboard shortcuts should apply stars and flags? Milestone 1 already defines the import and selection shortcuts: Command-A selects all, Escape clears the selection or closes settings, Command-Return imports the selection, and Command-R refreshes the list.
2. What public name, and what bundle id for personal use, should the app use? The current development identifier is `com.yunkou.ricoh-mac`. It is not the final identity.

---

## 9. To be validated on hardware

- Whether a GR IIIx on current firmware always exposes `192.168.0.1:80`, and what `GET /v1/ping` and `GET /v1/props` actually return.
- The JSON shape of `GET /v1/photos`, pagination or truncation, and firmware differences.
- Whether `size=thumb`, `size=xs`, and `size=view` exist on a GR IIIx, and their sizes and formats.
- Whether `GET /v1/photos/{folder}/{file}` without `size` can download a complete DNG, and whether DNG files appear in the list.
- If DNG cannot be transferred over Wi-Fi, whether version 1 should still meet the RAW preview requirement with DNG files already on disk (for example copied from a memory card into the target folder). This will be decided after testing on a real camera.
- Whether HTTP needs no authentication, and whether official Image Sync or Bluetooth pairing is required first.
- Whether `PUT /v1/photos/{folder}/{file}/transfer` changes camera state; version 1 should not call it by default.
- Real wireless throughput and stability, including large DNG files on a weak signal.

---

## 10. Sources

Official:

- [RICOH GR IIIx Operating Manual (PDF)](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf)
- [GR III / GR IIIx FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html)
- [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html)
- [Image Sync functional explanation](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/manual-00.html)
- [GR III / GR IIIx usability (Image Sync)](https://www.ricoh-imaging.co.jp/english/products/gr-3/feature/04.html)

Community (unofficial protocol notes):

- [Ricoh GR IIIx 802.11 reverse engineering (secretsauce, 2022-06-16)](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html)
- [dkogan/ricoh-download](https://github.com/dkogan/ricoh-download)
- [Namako GR3x wireless API (2024-05-11)](https://namako.tw/2024/05/11/gr3x-wireless-api/)
- [CursedHardware/ricoh-wireless-protocol](https://github.com/CursedHardware/ricoh-wireless-protocol)
- [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app)

Design and platform:

- [Impeccable](https://impeccable.style/)
- [Native Shell](https://nsh.dev/)

---

## 11. Milestone 1

Milestone 1 covers the first working path from a local save location to a read-only camera probe, a photo list, and an import into that folder. Camera HTTP behavior is documented from community sources and is to be validated on hardware.

### 11.1 Scope

1. On first launch, the user chooses a local save location. The path is saved in the application data directory and can be changed later.
2. On first connection, the app saves a camera profile (model, serial, and firmware when available, plus the camera Wi-Fi SSID) and stores the password in the macOS Keychain. Later, Connect Camera switches to the saved SSID, waits for `192.168.0.1`, then probes the camera with read-only requests (`GET /v1/ping` and `GET /v1/props`) and shows connected or not connected status, plus model information when it is available. If automatic switching fails, the app falls back to manual-join guidance. The app recommends Ethernet or iPhone USB tethering if the Mac still needs internet while it is on the camera network. After import, it switches back to the previous network by default, and the interface also offers a clear switch-back action. If the route to the camera goes through a `utun` tunnel, the interface shows a hint. The camera HTTP origin is configurable for development; the default is `http://192.168.0.1`.
3. The app lists photos on the camera with `GET /v1/photos`, and requests thumbnails with `size=thumb` when that parameter is available.
4. The user can download selected photos or all listed photos into the single save location. Original file names are kept. Each file is written to a temporary file in the same folder, checked against the expected size when it is known, then renamed into place. A file that is already present with the same name and size is skipped. Progress and per-file errors are shown. The app does not delete, rename, or rewrite files on the camera, and does not overwrite a complete local file whose size differs (that case is reported as a conflict).

Ratings, flags, RAW develop, and distribution are outside Milestone 1.

### 11.2 Acceptance criteria

- If no save location is saved, the UI asks the user to choose one before import. After a folder is chosen, the path is shown and can be changed.
- A probe reports success only after a successful read-only ping. Failure and timeout are shown as not connected, not as connected. Model and firmware are shown when `GET /v1/props` provides them.
- The UI includes first-time profile capture, later automatic switching, switch-back after import, and manual-join guidance as a fallback, plus the Ethernet or USB-tethering recommendation. The password does not appear in the config file. If the route to the camera goes through a tunnel interface, the interface shows a hint.
- A photo list is shown after a successful `GET /v1/photos`. An empty, failed, or unparsable list is explained and is not presented as a healthy empty camera state.
- Import keeps original names in the chosen folder, uses a `.partial` temporary file, skips name-and-size matches, reports same-name size conflicts without overwriting, and continues after a per-file error.
- An unattempted connection is not presented as an error. A successful probe loads photographs automatically and shows them in a virtualized thumbnail grid.
- “Import selected” is the primary action, and “Import all” is secondary. Actions that would start another import are disabled while an import is running. The progress bar shows the current file name. The completion summary distinguishes imported, skipped, conflict, and error counts.
- Headless tests cover ping, listing, download, deduplication, partial-download recovery, and a camera-offline case against a local mock HTTP fixture. Interface tests cover the first-run flow, selection, disabled import actions, and the progress summary against isolated module stand-ins. These tests are not a substitute for hardware validation.

## 12. Milestone 2

Milestone 2 covers local album browsing, the two-entry information architecture, the photo detail page, the photographer information panel, and an embedded DNG preview on the detail page. Stars, flags, filtering, album-grid DNG thumbnails, and a sensor-level RAW preview remain outside this milestone.

### 12.1 Scope

1. On launch, the app shows two feature entries: 设备 and 照片. The user can move between those areas with a compact segmented control, and can return to the home screen with a back control.
2. 设备 lists saved camera profiles, keeps the automatic Wi-Fi switching and Keychain password flow from Milestone 1, and is the place to connect, browse, select, and import camera photographs.
3. After an import finishes, the interface offers 查看照片, which opens 照片.
4. 照片 lists photograph files that already sit in the single save location, shows a thumbnail grid and a photo detail page, and remains usable with no camera connection. The listing is read-only and does not descend into subfolders.

### 12.2 Acceptance criteria

- Launch shows 设备 and 照片 and does not present an unattempted connection as an error.
- 设备 can list saved profiles and connect from a chosen profile, then browse and import as in Milestone 1.
- 照片 can be opened with no camera connection. If no save location is saved, the area asks the user to choose one.
- The album grid shows files that sit directly in the save location, including JPEG and DNG names. Hidden files, `.partial` files, and non-photograph files are omitted.
- Opening a photograph enters a detail page. The user can return to the album grid with Back or Esc, and can move to the previous or next photograph. The detail page shows photographer information. JPEG files display in the grid and on the detail page. The album grid does not preview DNG files; when a DNG contains an embedded preview, the detail page can show it and labels it as a preview. A file that cannot be displayed shows an explanation, not an empty frame.
- Browsing does not modify original files in the save location.
- After import, 查看照片 opens 照片 and shows the imported files.
