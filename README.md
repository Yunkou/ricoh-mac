# ricoh-mac

A Mac application for importing photos from a Ricoh GR IIIx over Wi-Fi, culling in a local album, and previewing RAW (DNG) files.

This repository contains the product requirements, technical design, and the Milestone 1 implementation: a local library folder, a read-only camera probe, a photo list, and import into that folder. Camera-dependent behavior is documented from public sources and is to be validated on hardware.

[Chinese README](README.zh-CN.md)

## Documents

- Product requirements: [docs/requirements.en.md](docs/requirements.en.md)
- Technical design: [docs/tech-stack.en.md](docs/tech-stack.en.md)
- Product record: [PRODUCT.md](PRODUCT.md)
- Design system: [DESIGN.md](DESIGN.md)
- Repository: <https://github.com/Yunkou/ricoh-mac>

## Version 1 scope

Must have:

- Connect to the camera over Wi-Fi (automatic switching with a saved camera profile; manual join as fallback)
- Browse and import photos from the camera into a single target folder, keeping original file names
- Browse a local album
- Fast culling with 1 to 5 stars and two flags: picked and rejected (stored in XMP sidecars and a local SQLite index), including batch rating and flags from a multi-selection in the album
- Copy every picked original in the album, plus any existing XMP sidecar, into a folder you choose, without overwriting a same-named file or changing the source files
- RAW / DNG preview

Not in version 1:

- AI-assisted culling (a later-version candidate)
- Developer ID signing, notarization, or distributing installers (version 1 is for personal use, with ad hoc signing only)

The version 1 stack is [Native Shell](https://nsh.dev/) 0.5.x, mixed TSX and Rust. Milestone 1 is pinned to NSH 0.5.1 (`nsh 0.5.1 (224d9a7)`). Details are in the technical design.

## Interface

On launch, the app shows two feature entries:

- **照片 (Photos):** browses photographs already imported into the single save location. It works without a camera connection. The album is a thumbnail grid and a standalone photo detail page. Click a photograph, or press Space or Enter, to open the page. The detail page provides previous and next controls, fit-to-window or actual size, and a right-hand photographer information panel. Back or Esc returns to the album grid. A compact hint and a “?” list document those shortcuts. JPEG files display in the grid and on the detail page. When a DNG contains an embedded JPEG preview, the album grid and the detail page can show that preview. The detail page labels it as a preview, not as original pixels. A file without a usable preview uses a placeholder in the grid. The app reads that folder and does not modify original files. The album grid does not decode sensor-level RAW data. In Photos, you can copy every picked photograph in the album, plus any existing XMP sidecar, into another folder. A file that already exists at the destination is left unchanged. Export uses the full picked set, not the current filter, and you can open the destination folder when it finishes.
- **设备 (Devices):** lists saved camera profiles, connects to the camera with automatic Wi-Fi switching (the password is stored in the macOS Keychain), then browses, selects, and imports photographs. After an import finishes, 查看照片 opens 照片. Failed items in the current session can be retried on their own.

The window has no product-name header and no persistent sidebar. A compact segmented control switches between the two areas, and a back control returns to the home screen. The circular icon is a corner settings entry.

## Develop, test, and run

Requires NSH 0.5.1, a Rust toolchain, and Xcode Command Line Tools. The official NSH installer places the binary under `~/.nsh` and links `~/.local/bin/nsh`. Add `~/.local/bin` to `PATH` if the shell cannot find `nsh`.

From the repository root:

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

The same steps are also available as `make check`, `make test`, `make package`, and `make clippy`. `nsh package --target macos` writes an ad hoc signed app at `.nsh/out/ricoh-mac.app`. `make dist` rebuilds that app and writes a versioned zip and SHA-256 checksum under `dist/`.

Native Shell requires the TSX entry `App.tsx` to sit beside `nsh.json` at the application root (the same directory as the Rust crate, which `nsh.json` names with `"rust": "."`). That entry only mounts the interface. The interface itself lives under `ui/`: `ui/App.tsx` composes the shell, `ui/components/` holds the views, `ui/state/` holds signals and flows, and `ui/lib/` holds helpers. Tests are `*.test.ts` / `*.test.tsx` files beside the code they cover, for example `ui/App.test.tsx` and `ui/lib/thumb-loader.test.ts`.

Development overrides:

- `RICOH_MAC_NO_WIFI_SWITCH` — when this environment variable is set to any value, the app does not switch the system Wi-Fi. Use it while developing against the mock fixture, or when the Mac is already on the camera network.
- Camera HTTP origin — the default is `http://192.168.0.1`. Change it in Settings (the value is stored as `camera_base_url` in the app `config.json`). Use Reset in Settings to restore the default.

To exercise the client without a camera, start the mock HTTP fixture and point the app at it:

```sh
cargo run --bin mock-camera
```

The fixture listens on `http://127.0.0.1:8080` by default (pass a bind address to change it). In Settings, set the camera address to that origin, then use the on-screen actions labeled 连接相机, 导入已选, or 全部导入. The fixture is for development and tests only; it is not a real camera.

On launch, the app shows 照片 and 设备. Choose a save location when prompted, or from Settings. To connect a real GR IIIx, open 设备 and turn on the camera wireless network. The first time, save the network name and password shown on the camera (or confirm the current network if the Mac is already joined). The password is stored in the macOS Keychain. Later, 连接相机 switches to that network automatically and, after import, switches back to the previous network by default. macOS may ask for Location Services so the app can fill in the current network name; you can decline and type the name instead. The first Keychain write may also ask for permission. If automatic switching fails, join the camera network in System Settings and try again. If the Mac still needs internet while it is on the camera network, use a wired connection or iPhone tethering. If a proxy is intercepting the camera network, exclude that network from the proxy and try again.

## Third-party fonts

The interface uses [ChillDINGothic](https://github.com/Warren2060/ChillDIN-ChillDINGothic) (寒蝉德黑体) version 1.300, Regular and SemiBold. The official OpenType files are bundled in the application and registered only for this process; they are not installed on macOS.

This Font Software is licensed under the SIL Open Font License, Version 1.1. Copyright © 2023 ChillType, with Reserved Font Name 'ChillDIN' and 'ChillDINGothic'; copyright © 2014-2021 Adobe, with Reserved Font Name 'Source'. The official license text ships with the application as well as in `ui/assets/fonts/LICENSE`. The files were copied unchanged from [release ChillDINGothic_v1.300](https://github.com/Warren2060/ChillDIN-ChillDINGothic/releases/tag/ChillDINGothic_v1.300); provenance and SHA-256 digests are recorded in `ui/assets/fonts/SOURCE.txt`.

## Releases

Version 1 GitHub Releases provide an ad hoc signed macOS application. They are not notarized and they are not signed with a Developer ID.

The application version is the same string in `nsh.json` (`version`) and in `Cargo.toml` (`package.version`). A release tag must be that string with a `v` prefix: version `0.1.0` is tagged `v0.1.0`. A prerelease follows the same rule, so version `0.1.0-rc.1` is tagged `v0.1.0-rc.1`. The release workflow fails if the tag and the two files are not identical.

To publish a release:

1. Set the same version in `nsh.json` and `Cargo.toml`, including any prerelease suffix such as `-rc.1` or `-beta.1`.
2. Commit the change on `main`.
3. Create an annotated tag and push it:

```sh
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Pushing a tag that matches `v*` starts the Release workflow. Packaging starts immediately on an arm64 runner. Publishing the GitHub Release waits until packaging has succeeded and the same commit has passed a quality gate: a successful CI run, or, if CI has not run for that commit, the same `nsh check`, `nsh test`, and `cargo fmt` / `clippy` steps that CI uses, with `RICOH_MAC_NO_WIFI_SWITCH=1`. If CI has already passed for that commit, the workflow does not run those checks again. The archive is named `ricoh-mac-<tag>-macos-arm64.zip` and is accompanied by a SHA-256 file. Tags whose version has a suffix such as `-rc` or `-beta` are published as prereleases. Re-running the workflow for an existing tag updates that Release and replaces the uploaded files. To rebuild an already-pushed tag with a newer workflow file, run the Release workflow from `main` with the `tag` input set to that tag, for example `gh workflow run release.yml --ref main -f tag=v0.1.0`. The workflow checks out the tag, packages that commit, and uploads the archive to the existing Release.


To rebuild the archive and checksum on an arm64 Mac without publishing:

```sh
make dist
```

By default this writes `dist/ricoh-mac-v<version>-macos-arm64.zip` and `dist/ricoh-mac-v<version>-macos-arm64.zip.sha256`, using the version from the files above. Pass `TAG=v0.1.0` to require a specific tag name.

After unzipping a downloaded build, macOS may block the first launch. Right-click `ricoh-mac.app` and choose Open, or remove the quarantine attribute:

```sh
xattr -dr com.apple.quarantine ricoh-mac.app
```
