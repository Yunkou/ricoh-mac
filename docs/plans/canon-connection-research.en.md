# Connecting a Canon camera: research and where it fits in this project

This note answers one question: a beta photographer uses a Canon camera, so how does it connect? Public sources were consulted on 16 and 17 November 2026 (Asia/Shanghai) and read against the repository at `v0.3.2` (commit `d3cd70e`). It is a research record, not an implementation plan, and it does not promise a schedule. It does not change decisions already recorded in [next-features.en.md](next-features.en.md) or [requirements.en.md](../requirements.en.md). If the two conflict, those decisions win.

Quoted phrases are short and cite their URL. Some vendor pages require registration or return HTTP 403 to a simple fetch; their body was read on the same day. Sources whose body could not be read are not quoted for content.

## Conclusion

Canon cameras connect, but the gap is not the same one as on a Ricoh GR IIIx. Ricoh gives wireless import only to phones and leaves the desktop empty. Canon gives the Mac official routes — a USB cable, EOS Utility, Image Transfer Utility 2, and image.canon — but those tools are old or gated by registration. Therefore:

- **Getting the beta photographer working today needs no connection code from this project.** A USB cable plus the system's Image Capture yields CR3 and JPEG files. When wireless is required, use the official EOS Utility.
- **Adding Canon wireless to this project is a different job, blocked by three hard gates:** Canon's API is open only to legally registered entities, most bodies need a one-time activation over USB, and this project cannot currently read CR3 at all.

## Evidence matrix

| Source | What it says | Relation to this project | Strength |
| --- | --- | --- | --- |
| [Canon Asia: Camera API Package overview](https://asia.canon/en/campaign/developerresources/cap) | CCAPI is an HTTP/1.1 + UPnP interface reachable over Wi-Fi or wired LAN, version 1.4.0. It states: "The Applicant must be a legally registered entity", and academic applications must come from the institution itself, "not by students or academic personnel in their personal capacity". The page accepts applications from a listed set of roughly a dozen countries and regions. It also says CCAPI covers "15 types or more in the EOS/PowerShot Series" and that only the EOS-1D X Mark III and EOS R3 support wired LAN control. | An individual developer, and by extension an open-source app aimed at individuals, is not an eligible applicant as the page is written. This is an access condition, not a technical one. | Strong (official page, body read) |
| [Canon Japan: SDK Camera API Package](https://personal.canon.jp/product/camera/software/api-package) | It states: 「Camera Control APIをご利用いただくには、カメラ本体の機能追加（アクティベーション）が必要になります。」 The 「アクティベーション対象機種」 list includes the EOS-1D X Mark III, R3, R5, R6, R6 Mark II, R7, R8, R10, R50, R100, 90D, Kiss X10i, Kiss X10, RP, Kiss M2, M200, G5 X II, G7 X III, and SX70 HS. The non-target list is the R1, R5 Mark II, R50 V, R6 Mark III, R6 V, and PowerShot V10. The tool price is listed as 「無償」 but is obtained through an application form. | Even with the interface, most current bodies have no CCAPI entry in the menu until the official activation tool has been run once over USB. The beta photographer's model decides whether this path exists at all. | Strong (official page, body read) |
| [Canon: CCAPI Operation Guide (PDF)](https://downloads.canon.com/sdk/CameraControlAPI_OperationGuide_EN.pdf) | The text of this PDF could not be extracted during this session, so its content is not quoted. | It is cited only as evidence that official documentation exists and is gated behind developer registration. | Weak (body not read) |
| [EOS Utility product page](https://app.ssw.imaging-saas.canon/app/en/eu.html?region=1) | The current version is 3.21.11, supporting "macOS 26 / 15 / 14". The model table includes the R1, R3, R5, R5 Mark II, R6, R6 Mark II, R6 Mark III, R7, R8, R10, R50, R50 V, R100, and RP, among others. | The official desktop wireless route is still maintained and is newer than Image Transfer Utility 2. Prefer it when wireless is needed. | Strong (official product page, body read) |
| [EOS Utility 3.x Wi-Fi transfer steps](https://th.canon/th/support/8204189300) | On the camera choose "Remote control (EOS Utility)" then "Register a device for connection" and note the SSID and password; join that SSID from the computer; confirm pairing on the camera; in EOS Utility choose "Pairing over Wi-Fi/LAN" and then "Download Images to computer". | The shape resembles Ricoh's "join the camera access point, then use HTTP", but the protocol differs: Canon pairs over PTP-related transport, which is not a read-only HTTP path that can be copied over. | Strong (official support page) |
| [Image Transfer Utility 2.2.30 for macOS](https://in.canon/en/support/0200726802) and [required computer environment](https://th.canon/th/support/8204116300) | Version 2.2.30 was released in November 2024 and supports macOS 13–15; the CPU requirement is written as "Intel Core 2 Duo or higher", with no native arm64 statement. | This is the official "camera sends images when powered on" shape, but it lags EOS Utility and does not declare native Apple Silicon support. It should not be the first recommendation. | Medium (download page strong; arm64 conclusion inferred, no vendor denial found) |
| [image.canon: automatic download to a PC or Mac](https://image.canon/st/zh/auto-download.html) | "Downloader for image.canon" supports "Windows 11 / Windows 10 / macOS 26（仅限搭载 Apple Silicon 的 Mac） / macOS 15 / macOS 14". Eligible files include 「静态图片、视频和 RAW 文件」, and files not downloaded within the storage window 「将从您的帐户中删除」 after 30 days. | This is an official route that avoids the local network, and it is the only one above that explicitly declares macOS 26 and Apple Silicon support. The costs are a cloud relay and a 30-day deadline. | Strong (official page, body read) |
| [Apple: RAW formats supported by iOS 26 / macOS Tahoe 26](https://support.apple.com/en-us/122870) | Listed by camera model, not by extension. The list includes the Canon EOS R1, R3, R5, R5 Mark II, R6, R6 Mark II, R6 Mark III, R7, R8, R10, R50, R50 V, R100, and RP, among others. | System-level CR3 decoding is added model by model, so "this Canon shoots CR3" does not imply "this Mac decodes that CR3". Enumerate `CIRAWFilter.supportedCameraModels` at runtime to confirm. | Strong (official support page, body read) |
| [Stack Overflow: `/contents` returns only 100 files](https://stackoverflow.com/questions/71195748/canon-ccapi-contents-returns-100-images-only/75240588) | `GET /ccapi/ver100/contents/sd/{dir}` returns at most 100 entries per page and needs paging; alternatively `/ccapi/ver130/contents/...?kind=chunked&order=desc` returns the whole folder as a `path` array. | If CCAPI import were implemented, list completeness would be the first engineering issue, and the shape differs from Ricoh's `/v1/photos`. | Medium (developer Q&A, not vendor documentation) |
| [libgphoto2: Canon PTP/IP discussion](https://sourceforge.net/p/gphoto/mailman/gphoto-devel/thread/20140216130014.GB14038%40suse.de/) and [INDI: Canon EOS-M support](https://www.indilib.org/forum/ccds-dslrs/5597-canon-eos-m-cameras-support/46706.html) | gphoto2 has a `ptpip:` transport (TCP 15740 by default), but Canon wireless pairing requires the GUID to be filled in by hand; the mailing list records one transfer succeeding and the next failing, and the INDI forum states "wifi connection option still is not supported on gphoto2". libgphoto2's model table covers the R6, R7, R10, R3, R6 II, R8, R50, R100, R5 II, R1, and R6 III over USB PTP. | Third-party routes that avoid Canon's authorization are not mature on the Canon wireless side. USB PTP, by contrast, is stable and widely implemented. | Medium (developer community, not vendor documentation) |
| [macOS multi-camera USB problems and `ptpcamerad`](https://eclipseclick.com/blog/macos-multi-camera-usb-challenges/) | `ptpcamerad` holds exclusive access to a PTP camera's USB interface and powers import for Image Capture, Photos, and Preview. | This supports the zero-code "USB plus Image Capture" route: it is built into the system and needs no Canon software. | Medium (technical blog, consistent with known system behavior) |

## Four routes that already exist on a Mac

| Route | Shape | When it fits | Notes |
| --- | --- | --- | --- |
| USB plus system Image Capture | The camera appears as a PTP device and the system reads it | Just get the files | No software to install; camera Wi-Fi usually has to be off while USB is connected |
| EOS Utility 3.21.11 | Official Wi-Fi remote control and download | Wireless, or remote control | Supports macOS 26 / 15 / 14 and covers the current R series |
| Image Transfer Utility 2.2.30 | Automatic send while the camera is on | Automatic backup | No update since November 2024; declares only macOS 13–15 |
| image.canon plus Downloader | The camera uploads; the Mac pulls down | Camera and computer on different networks | Originals and RAW kept for 30 days; the only tool that explicitly declares macOS 26 and Apple Silicon |

In short: **the beta photographer can get Canon files onto a Mac today without this project touching the connection.**

## If CCAPI is pursued, where the gates are

1. **Eligibility.** Canon requires the applicant to be a legally registered entity and restricts which regions it accepts. The Japanese page lists the tool as 「無償」 but still requires the application form. Community reports describe individual registrations passing quickly, but treating that as a dependency of a shipping app puts the risk on the project. The interface's terms of use are governed by Canon's licence; this note makes no legal judgement.
2. **Camera activation.** Most current bodies are 「アクティベーション対象機種」 and need a one-time USB-connected, online run of the official activation tool before the "Camera Control API" menu appears. Only the R1, R5 Mark II, R50 V, R6 Mark III, R6 V, and PowerShot V10 are non-targets.
3. **Access point and paths.** In access point mode, third-party material often writes `http://192.168.1.2:8080/ccapi`, but Canon directs users to the URL shown on the camera. Paths are `/ccapi/ver100/*`, unrelated to Ricoh's `/v1/*`.
4. **List pagination.** See the 100-entry limit in the evidence matrix.
5. **RAW is CR3, not DNG.**

## What is actually missing in this repository

These are checkable facts in the repository, and they show that most of the cost of "adding Canon" is not in the connection layer:

- **CR3 never appears in the album.** `is_listed` at `src/album.rs:28` accepts only `jpg`, `jpeg`, `png`, `gif`, `webp`, `tif`, `tiff`, `heic`, `heif`, `bmp`, and `dng`.
- **Format classification does not know CR3.** `src/metadata/mod.rs:126` maps `jpg`/`jpeg` to `jpeg` and `dng` to `dng`, and everything else to `other`.
- **RAW develop is hard-limited to DNG.** `is_dng` at `src/metadata/raw.rs:46` and the message 「只有 DNG 才能从 RAW 显影。」 at `:133`. `CIRAWFilter` underneath can handle CR3; the limit is this layer's check, not the system's capability.
- **Embedded preview extraction walks TIFF IFDs.** `src/metadata/preview.rs` looks for an embedded JPEG through the TIFF structure. CR3 is an ISO BMFF container, so that path does not hold for CR3 and would need to go through `CIRAWFilter` instead.
- **MakerNote parsing is Ricoh/Pentax only.** `src/metadata/makernote.rs` is a GR III / IIIx reader (`RICOH\0` + endianness + IFD count) and returns nothing for Canon files. The photographer panel on a Canon file could show only standard Exif.
- **The connection layer is a Ricoh-only protocol.** `src/camera.rs` is entirely GR's `/v1/ping`, `/v1/props`, and `/v1/photos`; `src/connect.rs:13` hard-codes the camera host as `192.168.0.1`.
- **What is reusable.** The "join a named SSID" and probe logic in `src/wifi.rs` is brand-independent and works with a Canon access point. The deduplication, conflict, and resume logic in `src/importer.rs` is also protocol-independent, provided the layer above can supply a name, a size, and a download URL.

## Recommendations and what not to do

Recommended order:

1. **Ask for the model and the real pain point first.** The model decides activation and whether this Mac decodes that CR3 variant; the pain point decides whether this project should touch the connection at all.
2. **Offer the zero-code route immediately.** Have the beta photographer copy CR3 and JPEG into one folder with a USB cable and system Image Capture. If they want to cull in this app, that needs "cull an existing folder", not a connection feature.
3. **If the feedback is "I cannot view CR3 after import", treat it as format work, not connection work.** Changes concentrate in `album.rs`, `metadata/mod.rs`, and `metadata/raw.rs`; preview goes through `CIRAWFilter`, and the MakerNote panel stays empty for Canon. This path never touches Canon's authorization conditions.
4. **Do not build CCAPI direct connection now.** Any one of three reasons is enough on its own: an individual developer is not an eligible applicant; most bodies need a one-time USB activation; and it serves only Canon users while the product is still positioned on the GR IIIx desktop workflow.

Explicitly not doing:

- Not changing the intended user in `docs/requirements.en.md` to "any camera".
- Not adding an EDSDK dependency. It is USB/PTP only, which is the opposite of "plug in less", and it is gated the same way.
- Not relying on gphoto2's `ptpip:` for Canon wireless import, given the community record of immature Canon pairing.
- Not putting image.canon or any cloud relay into this app's import path. It would introduce an account, a 30-day deadline, and upload behavior, beyond the existing promise of "one local save location".

## Minimum list to confirm with the beta photographer

1. Camera model and firmware version.
2. Whether a USB cable is acceptable; if wireless only, why.
3. File format: JPEG only, RAW + JPEG, or CR3 only.
4. If wireless is later considered: whether that model is on Canon's non-activation list.
5. On this machine, confirm that a real CR3 is recognized by the system: `mdls -name kMDItemContentType <file>` returning `com.canon.cr3-raw-image` means recognized, while `public.data` means unsupported; `sips -g pixelWidth -g pixelHeight <file>` further confirms whether it decodes.

Item 5 has to be done on the actual machine. The blanket claim that "macOS supports CR3" is not a substitute.

## Relation to the other planning documents

This note sits alongside [product-research-next.en.md](product-research-next.en.md): that one discusses next steps for the GR IIIx workflow, and this one discusses one beta user and a second brand. This note does not change the priority recommendations in that one, and it does not promote AI-assisted culling or side-by-side comparison.
