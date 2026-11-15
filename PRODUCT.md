# Product

<!-- impeccable:product-schema 1 -->

## Platform

macos

Impeccable’s documented platform values are `web`, `ios`, `android`, and `adaptive`. This product is a native macOS application built with Native Shell (NSH) 0.5.1. It is not a web app and it does not adapt a mobile design language per operating system. Native Impeccable audit guidance that targets iOS or Android does not apply as a literal checklist.

## Stack

The application is a mixed NSH 0.5.1 project: TSX for the user interface and Rust native modules for configuration, the read-only camera HTTP client, and import. The development bundle identifier is `com.yunkou.ricoh-mac`. That identifier is not a final public identity. The public application name is not decided.

## Users

The primary user is the owner of a Ricoh GR IIIx, using a Mac to import photographs over the camera’s Wi-Fi and later to cull them. Version 1 is for personal use. After a camera profile is saved, Connect Camera switches the Mac to the camera network automatically. While the Mac is on that network, Ethernet or iPhone USB tethering can keep internet access.

## Product Purpose

The application connects to a GR IIIx, switching to a saved camera Wi-Fi profile when one exists, lists photographs on the camera, and imports selected or all files into one local library folder, keeping original file names. Later milestones add a local album, star and flag culling, and RAW / DNG preview. Success in the current milestone means the user can choose a library folder, see a truthful connection state, browse camera photographs as a thumbnail grid, and import files without changing anything on the camera or overwriting complete local originals.

## Positioning

The product is a Mac desktop import and culling tool for the GR IIIx. Official Image Sync is phone-oriented. This application is built around a single library folder, original file names, a photograph-led dark workspace, and a read-only camera relationship.

## Operating Context

The user turns on the camera wireless LAN. On first connection the app saves the camera’s identity and Wi-Fi credentials (the password goes in the macOS Keychain). Later, Connect Camera switches to that network, waits for the camera, and loads photographs. After import, it switches back to the previous network by default. The default camera HTTP origin is `http://192.168.0.1` and can be changed for development or an unusual address. A local mock camera at `http://127.0.0.1:8080` exists for development. Hardware validation of community-documented camera HTTP APIs remains open even after a successful user-reported connect, list, and download session. Original camera photographs are read-only. Tests must not use the user’s real album or real configuration as fixtures.

## Capabilities and Constraints

Confirmed in Milestone 1:

- The user chooses a library folder on first launch. The path is stored in the application data directory and can be changed later.
- Connection uses read-only `GET /v1/ping` and `GET /v1/props`. A successful probe automatically loads the photograph list through `GET /v1/photos`. Thumbnails use `size=thumb` when the camera serves them, and are cached under the application data directory.
- Import writes into the single library folder, keeps original names, uses a `.partial` temporary file, skips name-and-size matches, reports same-name size conflicts without overwriting, and continues after a per-file error. The app does not delete, rename, or rewrite files on the camera.
- The interface is fixed dark, uses concise Chinese copy, has no product-name header, and has no persistent sidebar. A circular icon in the corner opens settings only (library folder, camera network profile, and advanced camera URL). Photographs occupy a virtualized thumbnail grid.
- Primary import is “import selected.” “Import all” is secondary. Keyboard shortcuts for this milestone are Command-A (select all), Escape (clear selection or close settings), Command-Return (import selected), and Command-R (refresh the list). These shortcuts do not intercept text entry. Shift-click range selection uses NSH `PressEvent` modifiers.
- Version 1 switches Wi-Fi automatically using a saved camera profile. The password is stored in the macOS Keychain. Location Services may be requested once so the app can read the current SSID; if permission is denied, the user types the name shown on the camera. Automatic switching falls back to manual-join guidance on failure. If the route to the camera goes through a `utun` tunnel, the interface shows a hint.

Out of scope for Milestone 1, and still planned for later milestones: local album browsing, 1 to 5 stars, picked and rejected flags, and RAW / DNG preview. AI-assisted culling, Developer ID signing, notarization, and installer distribution are outside version 1.

Undecided: keyboard shortcuts for stars and flags; the public application name and final bundle identifier; remaining camera HTTP details listed for hardware validation in the requirements document.

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
