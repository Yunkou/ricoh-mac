# ricoh-mac

A planned Mac app for importing photos from a Ricoh GR IIIx over Wi-Fi, culling in a local album, and previewing RAW (DNG) files.

This repository currently holds planning documents only. There is no runnable app code here. No feature is implemented, and nothing has been verified on a real camera.

[Chinese README](README.zh-CN.md)

## Documents

- Product requirements: [docs/requirements.en.md](docs/requirements.en.md)
- Technical design: [docs/tech-stack.en.md](docs/tech-stack.en.md)

## Version 1 scope

Must have:

- Connect to the camera over Wi-Fi (the user joins the camera network manually)
- Browse and import photos from the camera into a single target folder, keeping original file names
- Browse a local album
- Fast culling with 1 to 5 stars and two flags: picked and rejected (stored in XMP sidecars and a local SQLite index)
- RAW / DNG preview

Not in version 1:

- AI-assisted culling (a later-version candidate)
- Automatic Wi-Fi switching (a later-version candidate)
- Developer ID signing, notarization, or distributing installers (version 1 is for personal use, with ad hoc signing only)

The planned stack is [Native Shell](https://nsh.dev/) 0.5.x, mixed TSX and Rust. Details are in the technical design.

## Status

GitHub repository: <https://github.com/Yunkou/ricoh-mac>

These files are for local review first. Until you confirm them, they should not be treated as a published project description, and no code should be assumed to have been pushed.
