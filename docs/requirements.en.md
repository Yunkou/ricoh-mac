# Product requirements

**Document status:** A planning draft for review. This document does not describe shipping software, and it does not claim that any feature has been verified on a real Ricoh GR IIIx.

Repository: <https://github.com/Yunkou/ricoh-mac>
Companion design: [tech-stack.en.md](tech-stack.en.md)
Chinese version: [requirements.zh-CN.md](requirements.zh-CN.md)

---

## 1. Background and goals

The Ricoh GR IIIx stores photos on the camera or an SD card. Official wireless transfer is aimed at the Image Sync app on a smartphone, not at a Mac desktop workflow. This project is a Mac app that connects after the camera's Wi-Fi is on, browses and imports photos, supports fast culling in a local album, and previews RAW (DNG) files.

Version 1 covers only this path: camera to this Mac, then culling on this Mac. AI-assisted culling is out of version 1. The project is planned again from an empty repository and does not carry forward the earlier unpushed code.

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
- Waking the camera over Bluetooth, or letting the app switch the Mac's Wi-Fi automatically. Automatic network switching belongs in a later version.
- Distributing installers, Developer ID signing, and notarization. Version 1 is for personal use only.

### 3.3 Safety boundary

In version 1, camera access is limited to read-style probes and downloads. The app must not call endpoints that power off the camera, disable Wi-Fi, fire the shutter, or change settings, unless a later review approves them and they are verified on a real camera.

---

## 4. Functional requirements

Each item has a user story and acceptance criteria. Clauses that depend on the camera's wireless behavior use public sources as leads, and they stay adjustable until a real camera confirms them.

### 4.1 Connect to the camera over Wi-Fi

**User story:** As a user, after I turn on the camera Wi-Fi and join the camera network from macOS System Settings, the app detects the camera and tells me whether the connection succeeded, failed, or is still unverified.

**Decision:** In version 1, the user joins the camera Wi-Fi manually. The app does not switch the system network. Automatic network switching comes in a later version.

**Acceptance criteria:**

- The app gives clear steps: turn on the camera wireless LAN, join the SSID shown on the camera from System Settings, and enter the password shown on the camera LCD (the official [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html) says the password can be displayed on the camera LCD; the exact camera menu follows the [operating manual](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf)).
- Once the Mac has joined the camera network, the app probes reachability with read-only requests and shows success, failure, or timeout. It must not present an unverified state as connected.
- Version 1 does not switch the system Wi-Fi by itself, and it does not require the official Image Sync app to be installed or paired first. Whether official-app or Bluetooth pairing is required remains pending real-camera verification.
- On failure, the app shows an understandable reason (not on the camera network, no response, timeout) and does not change camera state.

Public leads (not an official SDK; pending real-camera verification): several independent write-ups say that a GR IIIx in Wi-Fi mode acts as an access point, that an HTTP service listens at `http://192.168.0.1/` on port 80, and that `GET /v1/ping` and `GET /v1/props` are used as read-only probes. Sources: the [secretsauce reverse-engineering note](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html), [Namako's GR3x write-up](https://namako.tw/2024/05/11/gr3x-wireless-api/), the [CursedHardware community OpenAPI](https://github.com/CursedHardware/ricoh-wireless-protocol), and [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app). Ricoh has not published an official HTTP SDK under these names.

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
- If the camera can serve DNG over the wireless path, version 1 should import DNG. If a real camera can only serve JPEG over Wi-Fi, the app must say so clearly and must not label a JPEG as RAW. If wireless transfer cannot deliver DNG, how version 1 should still meet the RAW preview requirement will be decided after testing on a real camera.

Public leads (pending real-camera verification): community clients commonly use `GET /v1/photos` to list folders and files, `GET /v1/photos/{folder}/{file}` to download the original, `?size=thumb` for a thumbnail, and `GET /v1/photos/{folder}/{file}/info` for metadata. Preview size parameters disagree: Namako records `size=xs` (about 1920×1080), snmkl/ricoh.app records `size=view`, and the community OpenAPI lists `xs`, `view`, and `thumb` with pixel sizes that do not fully match those write-ups. The query parameters and the JSON shape must be checked on a real camera. The community OpenAPI download response includes `image/jpeg` and `image/x-adobe-dng`, which suggests a full-file download may include DNG. Official Image Sync documentation says that resize-before-transfer supports JPEG only. Whether a complete DNG can be transferred over Wi-Fi therefore cannot be settled from official text alone.

### 4.3 Browse a local album

**User story:** As a user, after I choose a local folder as the album root, I can browse photos and thumbnails in it, open a large view, and go back to the list.

**Acceptance criteria:**

- The user chooses the album root with the system folder dialog. That folder is also the single import target. The app reads only that tree. It must not scan the system Photos library or other unauthorized paths.
- Lists and thumbnails remain usable with no camera and no network.
- After opening a photo, the user can go back and can move to the previous or next photo in the same folder.
- A file that cannot be decoded shows an explanation, not an empty frame.
- After a refresh or after entering a folder again, files added later inside the agreed scan scope should appear.

### 4.4 Fast culling, stars, or flags

**User story:** As a user, while browsing I can quickly star or flag a photo, later filter by star rating or flag, and find those choices still there the next time I open the app.

**Decision:** Ratings are 1 to 5 stars. There are two flags: picked and rejected. Ratings and flags are written to XMP sidecar files and also kept in a local SQLite index.

**Acceptance criteria:**

- Each photo can have a rating from 1 to 5 stars, or remain unrated.
- The app supports two flags: picked and rejected. A photo may have no flag, or one of the two flags. Unless a later review says otherwise, picked and rejected are mutually exclusive.
- Stars and flags can be applied with the keyboard or the pointer without breaking the browsing rhythm. Exact keyboard shortcuts are still pending confirmation.
- The list can be filtered by star rating or flag.
- Ratings and flags persist: they are written to an XMP sidecar next to the photo and mirrored into a local SQLite index for filtering. Version 1 must not write this data to the camera, and must not rewrite pixel bytes of imported originals. Storage details are in the technical design.
- After a flag is cleared or a star rating changes, the filtered list updates at once, and the sidecar and the index stay in sync.

### 4.5 RAW / DNG preview

**User story:** As a user, I can preview DNG files in the local album (and in the camera list when wireless browsing allows it) without developing them in another app first.

**Acceptance criteria:**

- For a local DNG, the app can show a preview. Version 1 should use an embedded JPEG preview, not a full demosaic render. The rationale is in the technical design.
- If a DNG has no usable preview, the UI says that it cannot be previewed and still shows basic information such as the file name.
- A failed preview must not damage or rewrite that DNG.
- Thumbnails for DNG files in the camera list depend on what the wireless interface actually returns, and need verification on a real camera.
- If testing on a real camera shows that DNG cannot be transferred over Wi-Fi, whether version 1 should still meet the RAW preview requirement with DNG files already on disk (for example copied from a memory card into the target folder) will be decided after that test. Until then, the item stays under pending real-camera verification.

Official documents confirm that the camera can record DNG, and can record RAW and JPEG together. See the [GR III / GR IIIx FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html) and the [operating manual](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf).

---

## 5. Non-functional requirements

### 5.1 Performance

- A thumbnail grid should stay usable for a typical shoot (target: a local list of at least several hundred photos remains operable). Exact limits should be set from measurements during implementation, and the design must avoid decoding every original at full size at once.
- Community notes say the camera Wi-Fi is 2.4 GHz and that thumbnails can be slow, so the app should lazy-load and cache locally. See [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app). Throughput needs measurement on a real camera.

### 5.2 Offline

- Local browsing, preview, starring, and flagging must work with no camera and no internet.
- Only reachability probes, camera browsing, and import need the camera network. The app must not pretend the camera is connected while offline.

### 5.3 Privacy

- Photos and ratings stay on the user's Mac by default. Version 1 must not upload originals or previews to any service.
- App settings are stored in the data directory the system gives this app, not in unrelated locations outside the user's album tree.
- Version 1 does not send analytics or crash reports off the machine unless that is agreed later.

### 5.4 Original-file safety

- Do not modify, delete, or move files on the camera.
- Do not rewrite pixel bytes of imported originals (JPEG, DNG, or other original files). Ratings and flags go to XMP sidecars and to the app's SQLite index.
- Do not rename or overwrite a user's complete existing file in the name of organizing.
- Tests must not use the user's real album or real config as fixtures.

### 5.5 Dark appearance

A fixed dark appearance is a carried-over preference, but the user has said that some UI preferences will change and has not yet said which ones. Until that is explicit, a fixed dark appearance is not a locked acceptance criterion. See section 6.

### 5.6 Signing and distribution

**Decision:** Version 1 is for personal use only. Ad hoc signing from `nsh package` is enough. There is no Developer ID signing and no notarization. Distributing an installer is out of scope for version 1.

---

## 6. UX principles (partly changing, details pending)

Carried-over UI preferences included: a fixed dark appearance for the whole app; substantial design work that follows the [Impeccable](https://impeccable.style/) method; no large product-name header in the UI; and no persistent sidebar, with navigation in a circular icon button that opens on click.

The user has said that some of these preferences will change, but has not yet said which items will change or what they will change to. Until those details are decided, the items above remain an open question and must not be treated as locked version 1 UI specifications.

---

## 7. Suggested milestones

This is a suggested order, not a dated commitment.

1. **M0 Planning:** Review this requirements document and the technical design.
2. **M1 App shell and local album:** Create the NSH 0.5.x mixed project, choose the target folder, and browse local thumbnails and large views. Visual design follows the UX decisions once they are confirmed.
3. **M2 Connection and camera browsing:** Probe the camera after the user joins its Wi-Fi by hand, list photos, and show thumbnails.
4. **M3 Import:** Copy selected photos into the single target folder, keep original file names, and support progress, deduplication, and resume.
5. **M4 Culling:** 1 to 5 stars, picked and rejected flags, filters, and persistence in XMP sidecars and SQLite.
6. **M5 RAW preview:** Embedded preview for local DNG. DNG in the camera list, and how version 1 meets the preview requirement if wireless transfer cannot deliver DNG, follow real-camera test results.

AI-assisted culling, automatic Wi-Fi switching, and Bluetooth wake go to later-version candidates.

---

## 8. Open questions

1. UI preferences (fixed dark appearance, the Impeccable design method, no large product-name header, and the circular icon menu) will change in part, but which items will change and what they will change to has not been stated. Until those details are decided, these items are not locked version 1 specifications.
2. What keyboard shortcuts should apply stars and flags?
3. What public name, and what bundle id for personal use, should the app use?

---

## 9. Pending real-camera verification

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
