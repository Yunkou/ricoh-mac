# Product notes on the GitHub Release page

This document describes how to turn the GitHub Release page into product notes for a regular person, and how to write the feature highlights for each version. The workflow has not been changed yet.

## Current state

Release notes are assembled from two parts today.

1. `scripts/release-notes-preamble.md` supplies bilingual install instructions. It leads with the ad hoc signature, the lack of notarization, and an `xattr` command to clear the quarantine flag. The SHA-256 checksum also appears early in this block.
2. The workflow then calls `gh api repos/.../releases/generate-notes`. For the published v0.1.0, v0.1.1, and v0.2.0 releases, that call has produced only a "Full Changelog" link, with no product feature list.

A person who opens the [v0.2.0 release page](https://github.com/Yunkou/ricoh-mac/releases/tag/v0.2.0) therefore sees signing limits and a command-line checksum first, and does not see the Photos and Devices entries, the local album, the large-image viewer, the frosted-glass window, or the font. The title is also fixed as `ricoh-mac ${TAG}`, which reads as a repository name rather than a product name.

## Suggested page layout

A GitHub Release has a single notes field. Keep both Chinese and English on that page, with Chinese first. Use this order:

1. 本版本更新 (Chinese)
2. What's new (English)
3. 安装 (Chinese)
4. Install (English)
5. Checksum (optional), with one short sentence in each language and a single copy of the hash

The "What's new" sections mention only changes a person can see or use, in product language. They do not list commit titles, file paths, test counts, workflow names, or dependency versions. A "Full Changelog" link is not the main content. If you want a commit comparison for yourself, place that link after the checksum and label it as a development record, not as the product summary.

Install steps are written for someone who does not use the terminal:

1. Download and unzip `ricoh-mac-vX.Y.Z-macos-arm64.zip`.
2. Drag `ricoh-mac.app` into the Applications folder.
3. The first time you open it, Control-click the app and choose Open. The app is signed with a personal signature and is not notarized by Apple, so macOS may say that the developer cannot be verified. Choose Open to continue.

Do not put an `xattr` command in the main steps. If it is kept at all, add it as one sentence at the end of the install section, for people who prefer the terminal.

The checksum section comes last, under a heading such as "Checksum (optional)". Give the file name and the SHA-256 once. Do not repeat the hash in the install section.

The release title should be "Ricoh Mac vX.Y.Z", or the agreed product name once that name is fixed.

## How notes are written for each release

Keep a pair of files in the repository for each version:

- `docs/releases/vX.Y.Z.zh-CN.md`
- `docs/releases/vX.Y.Z.en.md`

These files contain only the "What's new" text. They do not contain install steps or checksums. The install section still comes from a template, and the workflow fills in the checksum after the archive is built. The product wording can then be reviewed with the rest of the version, without committing a hash that is known only after packaging.

The release workflow should read this pair of files, then append the install template and the checksum section. If the files for the tag are missing, the release job should fail, so a release is not published again with install text and no feature highlights.

Writing rules:

- Write bullets about what a person can do, or what changed in the interface.
- Maintain the Chinese and English texts side by side so the meaning matches. Do not leave raw machine translation in either file.
- Use the same product words as the app, such as Photos, Devices, save location, and network name.
- A capability that already shipped in an earlier version, and is only carried forward, gets one sentence, and is not presented as new. For v0.2.0, the notes may say that ChillDINGothic is bundled in the app, and that this began in v0.1.1.

The files `docs/releases/v0.2.0.zh-CN.md` and `docs/releases/v0.2.0.en.md` remain the template for later releases. The already published v0.2.0 GitHub Release page is not rewritten in this format. The new page format starts from the next version.

## Decisions already made

Confirmed on 15 November 2026 (Asia/Shanghai):

- The new product-style release page format starts from the next version.
- The already published v0.2.0 GitHub Release page is not rewritten.
- `docs/releases/v0.2.0.zh-CN.md` and `docs/releases/v0.2.0.en.md` remain the template for later releases.

## Remaining decisions

- Whether the release title should use "Ricoh Mac", or keep the current app file name.
- Whether to keep a commit comparison link at the end of the notes.
