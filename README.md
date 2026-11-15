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
- Fast culling with 1 to 5 stars and two flags: picked and rejected (stored in XMP sidecars and a local SQLite index)
- RAW / DNG preview

Not in version 1:

- AI-assisted culling (a later-version candidate)
- Developer ID signing, notarization, or distributing installers (version 1 is for personal use, with ad hoc signing only)

The version 1 stack is [Native Shell](https://nsh.dev/) 0.5.x, mixed TSX and Rust. Milestone 1 is pinned to NSH 0.5.1 (`nsh 0.5.1 (224d9a7)`). Details are in the technical design.

## Develop, test, and run

Requires NSH 0.5.1, a Rust toolchain, and Xcode Command Line Tools. The official NSH installer places the binary under `~/.nsh` and links `~/.local/bin/nsh`. Add `~/.local/bin` to `PATH` if the shell cannot find `nsh`.

From the repository root:

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

The same steps are also available as `make check`, `make test`, `make package`, and `make clippy`. `nsh package --target macos` writes an ad hoc signed app at `.nsh/out/ricoh-mac.app`.

Development overrides:

- `RICOH_MAC_NO_WIFI_SWITCH` — when this environment variable is set to any value, the app does not switch the system Wi-Fi. Use it while developing against the mock fixture, or when the Mac is already on the camera network.
- Camera HTTP origin — the default is `http://192.168.0.1`. Change it in Settings (the value is stored as `camera_base_url` in the app `config.json`). Use Reset in Settings to restore the default.

To exercise the client without a camera, start the mock HTTP fixture and point the app at it:

```sh
cargo run --bin mock-camera
```

The fixture listens on `http://127.0.0.1:8080` by default (pass a bind address to change it). In Settings, set the camera address to that origin, then use the on-screen actions labeled 连接相机, 导入已选, or 全部导入. The fixture is for development and tests only; it is not a real camera.

On first launch, choose a library folder. To connect a real GR IIIx, turn on the camera wireless LAN. The first time, save the SSID and password shown on the camera (or confirm the current network if the Mac is already joined). The password is stored in the macOS Keychain. Later, Connect Camera switches to that network automatically and, after import, switches back to the previous network by default. macOS may ask for Location Services so the app can read the current SSID; you can decline and type the name instead. The first Keychain write may also ask for permission. If automatic switching fails, join the camera network in System Settings and try again. If the Mac still needs internet while it is on the camera network, use Ethernet or iPhone USB tethering. If a proxy such as Clash Verge is in TUN mode and hijacks `192.168.0.1`, exclude that address from the proxy.
