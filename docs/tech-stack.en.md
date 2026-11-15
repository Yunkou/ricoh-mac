# Technical design

Companion requirements: [requirements.en.md](requirements.en.md)
Chinese version: [tech-stack.zh-CN.md](tech-stack.zh-CN.md)

The NSH line is **0.5.x**, matching the current stable release series. Milestone 1 is pinned to **0.5.1**. The recorded `nsh -V` output is `nsh 0.5.1 (224d9a7)`.

---

## 1. Stack overview

Version 1 is a desktop app for macOS 14 or later, using the official Native Shell mixed template: TSX for the UI, Rust for the camera protocol, import, index, and preview decode. Official pages: [Getting started](https://nsh.dev/docs/getting-started.md) and [Building with Rust](https://nsh.dev/docs/rust.md). `nsh init --template mixed` creates `Cargo.toml` and `src/lib.rs` beside `App.tsx`, and `nsh.json` points at that crate with `"rust": "."`.

This stack is used because it keeps native Mac UI iteration (TSX hot updates) and reliable import I/O (Rust) in one project. Version 1 does not add a separate web backend, and it does not run the core protocol synchronously in TSX.

---

## 2. NSH architecture

### 2.1 Layers

- **TSX UI:** The window, album grid, import progress, connection state, and culling shortcuts. Component functions run once, as the official rules describe. Signals and dynamic props must be read in bindings, `If`, or `Each`. See the reactivity notes in [Building with Rust](https://nsh.dev/docs/rust.md) and the official common-mistakes guidance. Visual design follows the UX decisions in the requirements document once the open items are resolved.
- **Rust native module:** `#[native_module("…")]` exports typed modules and functions to TSX. Declarations are generated into `.nsh/types` and checked by `nsh check`. See [Building with Rust](https://nsh.dev/docs/rust.md).
- **System capabilities:** Desktop file dialogs use Rust `pick_paths(OpenDialog::…)`. Settings and the index live in the app data directory. See [Building with Rust: Files and folders](https://nsh.dev/docs/rust.md).

### 2.2 Threads and blocking work

Official documentation says `background` and `blocking` run work on the native target's threads, and `run_on_main_thread` is for AppKit APIs that must run on the main thread. See [Building with Rust](https://nsh.dev/docs/rust.md).

Implementation rules:

- Run HTTP probes, listing, downloads, hashing, and file copies in `blocking` or an equivalent background task. Do not stall the engine thread.
- Dispatch any ImageIO or AppKit call that truly needs the main thread with `run_on_main_thread`. Which APIs actually require that is to be verified during implementation. Automatic Wi-Fi switching in version 1 uses `/usr/sbin/networksetup` and `/sbin/route` on a background thread, not CoreWLAN on the main thread.
- Snapshot `data_dir()` and other reactive environment values on the engine thread before entering `blocking`. Official standard-module notes say the app's own Rust runs with the process permissions, but some NSH environment APIs depend on the reactive runtime. The exact failure mode of a cross-thread misuse will be verified during implementation.

### 2.3 Data directory and settings

The NSH 0.5 release notes say `data_dir()` exposes the app's own data directory. TSX has `process.dataDir`, and `nsh.json` `capabilities.fs` can use `${dataDir}`. See the [0.5.0 release notes](https://nsh.dev/releases/) and [Standard modules](https://nsh.dev/modules/standard-modules.md). The official OTA local-trial example uses `~/Library/Application Support/<bundle-id>/updates`, which is supporting evidence for the macOS layout; see [OTA Updates](https://nsh.dev/docs/ota-updates.md). The exact path returned by `data_dir()` for this app will be recorded from a real call during implementation.

Persistence rules:

- Keep a small `config.json` (or equivalent) for the target folder path, window preferences, and device display names, written atomically (write a temporary file, then replace).
- Keep the photo index in SQLite, stored separately, as in sections 5 and 6, so a large index is not stuffed into one settings file.
- The data directory does not hold user originals. Originals live only in the target folder the user chose.
- One authoritative copy of ratings and flags is the XMP sidecar in the target folder. SQLite holds a mirror of the same data for filtering.

A standalone app without a `capabilities` key is described as more open for local files. Once `capabilities` are declared, a local `file:` image must also fall under an `fs.read` root; see [Image](https://nsh.dev/elements/image.md). Implementation will choose either a standalone app without capabilities, or declared roots that always include the user target folder. That choice is to be verified during implementation.

---

## 3. Camera connection

### 3.1 Official product behavior and community protocol

Official product material places wireless transfer in Image Sync on a smartphone: turn on the camera wireless LAN, select the SSID on the phone, and enter the password shown on the camera LCD. Some systems also require location access before an SSID list can be read. Bluetooth pairing appears in official Image Sync notes for GR III and GR IIIx. See [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html). Ricoh has not published an HTTP SDK for third-party Mac apps.

Community research of firmware and Image Sync describes an HTTP API: the camera is an access point, usually at `http://192.168.0.1/v1` (the community OpenAPI also lists `192.168.1.1`, mainly for the G900SE, not as the default GR IIIx description). See [secretsauce](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html) and [CursedHardware/ricoh-wireless-protocol](https://github.com/CursedHardware/ricoh-wireless-protocol). Namako reports that a browser can call the API with no authentication after joining the camera Wi-Fi. None of this is an official guarantee, and it is to be rechecked on a real camera with the target firmware.

Version 1 uses only the following read-style requests (names from community sources; to be validated on hardware):

- `GET /v1/ping`: reachability probe.
- `GET /v1/props`: read-only properties, to show a model name if those fields exist.
- `GET /v1/photos`: listing.
- `GET /v1/photos/{folder}/{file}` and the documented `size` query: download or preview.
- `GET /v1/photos/{folder}/{file}/info`: optional metadata.

Version 1 must not call the community-documented `POST /v1/device/finish`, `POST /v1/device/wlan/finish`, capture or focus endpoints, or `PUT /v1/params/…`. `PUT /v1/photos/{folder}/{file}/transfer` may set a transfer flag on the camera, so version 1 does not call it by default. Adding it later would require a scope change and hardware validation of its side effects.

### 3.2 Version 1 connection (decided)

**Decision:** Version 1 saves a camera profile on first connection and later switches the Mac’s Wi-Fi automatically. This supersedes the earlier decision that version 1 would only support a manual join. The camera HTTP origin remains `http://192.168.0.1` by default, and is still configurable for development or an unusual address.

The chosen join mechanism is `/usr/sbin/networksetup -setairportnetwork`, with `/usr/sbin/networksetup -getairportnetwork` to read the current SSID when possible, and `/sbin/route -n get 192.168.0.1` to see whether that route leaves through a `utun` (or similar) interface. This is preferred over [Core WLAN](https://developer.apple.com/documentation/corewlan) `associateToNetwork:password:` as the primary path because association through CoreWLAN typically needs a scan first, and a scan is gated by Location Services on recent macOS. `networksetup` can join a known SSID and password without scanning. Switching back uses the same tool with the remembered previous SSID and no stored password for that network; it relies on the network already being in the macOS preferred list.

Apple DTS wrote that, from a stated system change onward, reading the current SSID needs Location permission (`CWInterface` header comments; [forums thread 732431](https://developer.apple.com/forums/thread/732431?answerId=758114022)). `networksetup -getairportnetwork` is subject to the same restriction on macOS 14 and later. The app therefore declares `NSLocationUsageDescription` and `NSLocationWhenInUseUsageDescription` in `nsh.json` `macos.infoPlist`, which NSH copies into the packaged app’s Info.plist ([Packaging](https://nsh.dev/docs/packaging.md)). Location is used only to capture the current SSID during first-time profile setup. If permission is denied, the user types the SSID shown on the camera. The app does not request `com.apple.developer.*` entitlements or a Keychain access group, because those require a provisioning profile and are not available to a personal ad hoc signed app.

Wi-Fi passwords are stored in the macOS Keychain as generic passwords (service `com.yunkou.ricoh-mac.camera-wifi`) through the `security-framework` crate, behind a `SecretStore` trait. Profile metadata is stored as JSON in the application data directory and never includes the password. Automated tests use an in-memory secret store and a fake Wi-Fi controller, and must not call `networksetup -setairportnetwork`. Setting `RICOH_MAC_NO_WIFI_SWITCH` also prevents the production controller from switching networks during development.

Waking Wi-Fi over Bluetooth appears in community feasibility notes, and official Image Sync describes phone-side Bluetooth pairing. Version 1 does not treat that as an acceptance criterion.

---

## 4. Import pipeline

**Decision:** Every imported file goes into one user-chosen target folder and keeps the camera's original file name. The import still writes a temporary file, validates it, then renames it into place, and it keeps the existing deduplication rules.

Flow:

1. The user chooses the target folder with `pick_paths(OpenDialog::folders())` (see [Building with Rust](https://nsh.dev/docs/rust.md)). That folder is also the local album root.
2. The app fetches the camera list and browses thumbnails (the `size` parameter follows real-camera results).
3. The user selects files to import. The app computes a destination path in the target folder from the camera's original file name and checks for a complete copy already on disk.
4. The download is written to a temporary file in the same folder (for example `R0001234.DNG.partial`). It may resume with HTTP range requests or with the bytes already on disk. After the download is complete and the length checks out (when `Content-Length` or a known size exists), the file is renamed into place atomically.
5. The app writes an index row in local SQLite: source path, destination path, size, checksum, import time, and the camera file name.

Deduplication: treat a file as already imported when the destination path exists and the size (and optional checksum) matches. Do not deduplicate in other folders by file name alone. If two source files would land on the same name but their content differs, the app must report a conflict and must not overwrite a complete original that is already there. That is a direct consequence of putting every file into one folder and keeping original names.

Whether the camera supports HTTP Range is to be validated on hardware. If it does not, resume should discard the incomplete temporary file and download again, while still skipping a complete final file.

Official notes also say that auto power-off is suppressed while a wireless connection or transfer is in progress, and that wireless LAN is disabled during USB connection. See [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html). The app should mention these limits in its import guidance.

---

## 5. Local album and index

The authority for the local album is the files on disk. The app index is a cache and query layer, not the only source of truth.

Rules:

- Default scan scope is the photo files that sit directly in the target folder. Version 1 does not add a day-folder layer. Whether user-created subfolders inside that folder are scanned will be decided during implementation, and the UI should say so.
- Store the index in SQLite under `data_dir()`, with relative path, file name, extension, size, optional checksum, capture time (if EXIF or `info` provides it), star rating (1 to 5, or unrated), flag (picked, rejected, or none), and import source.
- SQLite is used because filters, sorts, and incremental updates stay consistent more easily than one JSON file, and later columns are easier to add.
- When the index and the folder disagree, the disk wins: a refresh inserts new files and drops missing paths, and it must not delete originals on disk. If a sidecar exists, a refresh should reconcile it with the index.
- Thumbnail caches may live under `data_dir()`, keyed by content hash or by path plus modification time, and they can be rebuilt if lost.

JPEG and PNG should be shown with NSH `Image` first. Official [Image](https://nsh.dev/elements/image.md) documentation says the source may be a URL, an asset, `data:`, or `blob:`, and that on desktop an absolute path or `file:` URL can load when `fs.read` covers it. Whether NSH `Image` decodes DNG itself is not documented and is to be validated. Do not inline huge files as unbounded base64.

---

## 6. Storage for ratings and flags

**Decision:** Write ratings and flags to XMP sidecar files and also keep a local SQLite index. Ratings are 1 to 5 stars. The flags are picked and rejected.

Rules:

- Write a sidecar next to the imported file (align the file-name pattern with common tools during implementation, for example `R0001234.xmp` or `R0001234.DNG.xmp`), using standard fields such as `xmp:Rating`. Represent picked and rejected with explicit sidecar fields, which will be chosen and documented during implementation.
- Mirror the same data into SQLite for list filtering and sorting.
- Do not change JPEG or DNG pixels, and do not write into metadata packets inside those original files.
- Do not write sidecars onto the camera, and do not send ratings back over Wi-Fi.
- When a rating or flag changes, update the sidecar and the index together. If a sidecar is missing, the app may temporarily use the index and, when it is safe, offer to rebuild the sidecar.
- The "database only" option was not chosen, because other tools would not see the marks, and the marks would vanish if only the data directory were lost. Writing XMP or EXIF inside the image file was not chosen, because it would rewrite original bytes.

The meaning of `xmp:Rating` follows Adobe's XMP documentation: the [XMP xmp namespace](https://developer.adobe.com/xmp/docs/XMPNamespaces/xmp/). Round-trip compatibility with Lightroom or other tools, and the sidecar file-name pattern, are to be validated.

---

## 7. RAW / DNG preview

Official recording format is 14-bit DNG, and it can be saved together with JPEG. See the [FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html).

For DNG files already on disk, version 1 should use an embedded JPEG preview or an ImageIO thumbnail, not a full demosaic render. On macOS, read an embedded preview or create a thumbnail through ImageIO (for example `CGImageSource` and `CGImageSourceCreateThumbnailAtIndex` via `objc2` bindings), then hand the bitmap or a cached JPEG to the UI. Official conceptual notes: [Creating and Using Image Sources](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/ImageIOGuide/imageio_source/ikpg_source.html). API: [Image I/O](https://developer.apple.com/documentation/imageio).

The rationale is that culling needs a timely, stable picture, not final color. An embedded preview is commonly already inside a camera DNG, it is cheap to decode, and it does not modify the file. Full RAW demosaic belongs in a later version.

The app may also probe passing a DNG path straight to NSH `Image`. If the runtime uses ImageIO and happens to display the file, this is the cheapest path. Official Image documentation does not list DNG, so the behavior is to be validated. Even if it works, a fallback is still required.

Cached previews may live under `data_dir()` and must not be written back into the DNG. Whether EXIF orientation is always applied is to be validated. How `objc2` and ImageIO link inside an NSH mixed package, and how the sandbox affects local file reads, will be verified during implementation.

**To be validated on hardware:** If DNG cannot be transferred over Wi-Fi, whether version 1 should still meet the RAW preview requirement with DNG files already on disk (for example copied from a memory card into the target folder). This item stays in section 10.2 and will be decided after hardware validation.

---

## 8. Testing strategy

- **Rust unit tests:** Use temporary directories and a local temporary HTTP server to cover path checks, atomic writes, deduplication, same-name conflicts, partial files, index refresh, and sidecar-to-SQLite sync. Do not touch the user's real album or real config.
- **Protocol fixtures:** Keep checked sample JSON and binaries (small synthetic JPEGs and a minimal DNG fixture) in the test tree. After real-camera verification, fixtures may be updated from anonymized responses, but user originals must not be committed.
- **NSH UI tests:** Use the official headless `nsh test` engine and `modules` stubs where the target allows them. Official notes on headless `open()`, `data_dir`, and whether `modules` work on a real `macos` target should be followed as written in the then-current docs. Distinguish headless runs from `nsh test --target macos` in the test notes. See [CLI](https://nsh.dev/docs/cli.md) and [macOS](https://nsh.dev/docs/macos.md).
- **Real-camera tests (manual):** Connection, listing, thumbnail size parameters, JPEG and (if available) DNG import, resume after interrupt, and the preview policy if wireless transfer cannot deliver DNG. Do not treat scripted GUI driving as default CI.
- Continuous integration runs unit tests and headless UI tests only, and does not connect to a real camera.

---

## 9. Build, package, and signing

Daily commands (official [CLI](https://nsh.dev/docs/cli.md), [macOS](https://nsh.dev/docs/macos.md), [Packaging](https://nsh.dev/docs/packaging.md)):

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

`nsh package --target macos` writes a `.app` under `.nsh/out/`. Official documentation says that bundle is **ad hoc signed**, and requires macOS 14 or a later version the app declares. See [Packaging: macOS](https://nsh.dev/docs/packaging.md). Building runners on a Mac needs Xcode Command Line Tools (`codesign`, `sips`, and related tools); see [macOS](https://nsh.dev/docs/macos.md).

**Decision:** Version 1 is for personal use only. The ad hoc signature above is enough. There is no Developer ID signing and no notarization. Distributing an installer is out of scope for version 1. The official path of "sign with a Developer ID and notarize before distributing to other Macs" does not apply to version 1 of this project.

The `id` in `nsh.json` must be a reverse-DNS name; official tooling warns about the `com.example.` placeholder. See [Packaging](https://nsh.dev/docs/packaging.md). The exact id for personal use is recorded under Open Questions in the requirements document. A placeholder must not be used as the final identity.

`nsh publish` and `.nshpkg` are signed packages for a host to load, which is not the same as a user-installable `.app`. See [Signed Packages](https://nsh.dev/docs/signed-packages.md). Version 1 is packaged on the development Mac with `nsh package --target macos`.

Do not commit signing keys, notarization credentials, or `.secret` files.

---

## 10. Risks and items to validate

### 10.1 Risks

- The wireless protocol comes from community reverse engineering. Firmware updates may change it, and Ricoh has not committed to third-party clients.
- Community descriptions of the preview `size` parameter disagree. A hard-coded wrong value can fail thumbnails or download an oversized original.
- If Wi-Fi cannot transfer DNG, how version 1 should still combine "import from the camera" with "RAW preview" will be decided after a real-camera test.
- Putting every file into one target folder and keeping original names can produce name conflicts across different shooting days. The app must report those conflicts and must not overwrite.
- An ad hoc signed `.app` may be blocked by Gatekeeper on other Macs. Version 1 does not distribute installers, so this is not a version 1 acceptance criterion, but a copy taken to another machine may still be affected.

### 10.2 To be validated on hardware or at runtime

In addition to the camera items in section 9 of the requirements document:

- If DNG cannot be transferred over Wi-Fi, whether version 1 should still meet the RAW preview requirement with DNG files already on disk (for example copied from a memory card into the target folder). This will be decided after hardware validation.
- Whether NSH `Image` can display a local DNG, and how `file:` paths behave with and without `capabilities`.
- The exact path returned by `data_dir()` for this app's bundle id.
- Constraints on calling `data_dir()` or other environment APIs inside versus outside `blocking`.
- ImageIO compatibility with GR IIIx DNG embedded previews, orientation, and `objc2` linking.
- Whether the camera supports HTTP Range resume.
- XMP sidecar interchange with common tools, and the file-name pattern to use.
- The ad hoc signature produced by `nsh package --target macos` on this machine, and whether that is enough to run the app locally (version 1 does not notarize).

---

## 11. Sources

NSH (official):

- [Native Shell](https://nsh.dev/)
- [Installation](https://nsh.dev/docs/installation/)
- [Getting started](https://nsh.dev/docs/getting-started.md)
- [CLI](https://nsh.dev/docs/cli.md)
- [Building with Rust](https://nsh.dev/docs/rust.md)
- [Standard modules](https://nsh.dev/modules/standard-modules.md)
- [Image](https://nsh.dev/elements/image.md)
- [Packaging](https://nsh.dev/docs/packaging.md)
- [macOS](https://nsh.dev/docs/macos.md)
- [Device and environment](https://nsh.dev/docs/device-and-environment.md)
- [Signed packages](https://nsh.dev/docs/signed-packages.md)
- [OTA Updates](https://nsh.dev/docs/ota-updates.md)
- [Release notes (0.5.x)](https://nsh.dev/releases/)

Ricoh official:

- [RICOH GR IIIx Operating Manual (PDF)](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf)
- [GR III / GR IIIx FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html)
- [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html)
- [Image Sync functional explanation](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/manual-00.html)

Community wireless protocol:

- [secretsauce GR IIIx 802.11 note](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html)
- [dkogan/ricoh-download](https://github.com/dkogan/ricoh-download)
- [Namako GR3x wireless API](https://namako.tw/2024/05/11/gr3x-wireless-api/)
- [CursedHardware/ricoh-wireless-protocol](https://github.com/CursedHardware/ricoh-wireless-protocol)
- [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app)

Apple and metadata:

- [Core WLAN](https://developer.apple.com/documentation/corewlan)
- [Requesting authorization to use location services](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)
- [Apple Developer Forums thread 732431](https://developer.apple.com/forums/thread/732431?answerId=758114022)
- [Image I/O](https://developer.apple.com/documentation/imageio)
- [Creating and Using Image Sources](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/ImageIOGuide/imageio_source/ikpg_source.html)
- [Adobe XMP xmp namespace](https://developer.adobe.com/xmp/docs/XMPNamespaces/xmp/)

---

## 12. Milestone 1 implementation notes

The toolchain used for Milestone 1 is **NSH 0.5.1** (`nsh 0.5.1 (224d9a7)`), installed with the official `install.sh` and pinned to the 0.5.x stable line. `Cargo.toml` depends on `nsh-core` and `nsh-base` 0.5.1.

The mixed app lives in the repository root:

- `App.tsx` is the TSX UI. It uses a fixed dark appearance and a warm amber accent, with no product-name header and no persistent sidebar. A circular corner button opens settings only. Photographs are shown in a virtualized thumbnail grid through `List` `numColumns`. Visual tokens live in `theme.ts`, copy in `copy.ts`, and selection helpers in `selection.ts`. The design record is in `DESIGN.md` and `PRODUCT.md` at the repository root.
- `src/lib.rs` exports two Rust modules to TSX as `ricoh-mac/native`: `Library` and `Camera`.
- `src/config.rs` stores the library folder and camera base URL in `config.json` under `data_dir()`, written with a temporary file and an atomic rename.
- `src/camera.rs` is the read-only HTTP client: `GET /v1/ping`, `GET /v1/props`, `GET /v1/photos`, original-file download, and optional `size=thumb`. It does not issue POST or PUT requests. The default origin is `http://192.168.0.1` and can be changed in the UI for development.
- `src/importer.rs` writes into the single library folder, keeps original file names, uses a `.partial` temporary file, skips name-and-size matches, and reports same-name conflicts without overwriting.
- `src/mock_camera.rs` and `src/bin/mock-camera.rs` provide a local HTTP fixture for tests and for UI work without a camera.

Long-running HTTP and file work run inside `blocking()`. `data_dir()` is read in async module functions before that work starts. Folder picking uses `pick_paths(OpenDialog::folders())`.

Tests: `nsh test` runs the Rust unit and fixture tests (ping, list, download, deduplication, partial-download recovery, camera offline) and headless UI tests. The UI tests replace `ricoh-mac/native` through `open` `modules`, and they cover first launch, automatic listing after a successful connection, selection, disabled import actions, and the progress summary. They do not read the user’s real library or configuration. Those tests are not hardware validation.

Development commands:

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
cargo run --bin mock-camera
```

The mock server defaults to `http://127.0.0.1:8080`. Set that origin as the camera base URL in the app to exercise listing and import without joining camera Wi-Fi. Camera endpoints and JSON shapes remain to be validated on a real GR IIIx.
