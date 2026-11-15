# 技术文档

配套需求：[requirements.zh-CN.md](requirements.zh-CN.md)
英文版：[tech-stack.en.md](tech-stack.en.md)

NSH 版本约定为 **0.5.x**（与当前稳定发行说明一致）。第一里程碑锁定为 **0.5.1**。已记录的 `nsh -V` 输出为 `nsh 0.5.1 (224d9a7)`。

---

## 1. 技术选型总览

第一版是 macOS 14 或更高版本上的桌面应用，使用 [Native Shell](https://nsh.dev/) 的官方 mixed 模板：TSX 负责界面，Rust 负责相机协议、导入、索引和预览解码。官方说明见 [Getting started](https://nsh.dev/docs/getting-started.md) 与 [Building with Rust](https://nsh.dev/docs/rust.md)：`nsh init --template mixed` 会在 `App.tsx` 旁生成 `Cargo.toml` 与 `src/lib.rs`，并由 `nsh.json` 的 `"rust": "."` 指向该 crate。

选择这条技术栈，是因为它能在同一工程里同时满足原生 Mac 界面迭代（TSX 热更新）和需要可靠 I/O 的导入逻辑（Rust）。第一版不引入单独的 Web 后端，也不把核心协议放在 TSX 里同步执行。

---

## 2. NSH 架构

### 2.1 分层

- **TSX 界面：** 窗口、相册网格、导入进度、连接状态、选片快捷操作。组件函数按官方规则只执行一次，signal 与动态属性必须在绑定、`If` 或 `Each` 中读取，见 [Building with Rust](https://nsh.dev/docs/rust.md) 对 Reactivity 的说明，以及 NSH 文档中的常见错误。具体外观以需求文档中开放问题明确后的 UX 决定为准。
- **Rust native module：** 通过 `#[native_module("…")]` 向 TSX 导出类型化模块与函数，声明生成到 `.nsh/types`，由 `nsh check` 检查。见 [Building with Rust](https://nsh.dev/docs/rust.md)。
- **系统能力：** 桌面文件对话框用 Rust 的 `pick_paths(OpenDialog::…)`；配置与索引写在应用数据目录。见 [Building with Rust：Files and folders](https://nsh.dev/docs/rust.md)。

### 2.2 线程与阻塞

官方文档写明：`background` 与 `blocking` 把工作放到原生目标的线程上；需要在主线程调用的 AppKit API 则使用 `run_on_main_thread`。见 [Building with Rust](https://nsh.dev/docs/rust.md)。

实现约定：

- HTTP 探测、列表、下载、哈希、文件系统复制放在 `blocking` 或等价的后台任务中，不要堵引擎线程。
- 任何必须在主线程执行的 ImageIO 或 AppKit 调用，经 `run_on_main_thread` 调度。哪些 API 真正要求主线程，将在实现时验证。第一版的自动切网在后台线程调用 `/usr/sbin/networksetup` 和 `/sbin/route`，不在主线程调用 CoreWLAN。
- 进入 `blocking` 之前，在引擎线程快照 `data_dir()` 或其他反应式环境值。官方标准模块文档指出，应用自己的 Rust 代码以进程权限运行，但部分 NSH 环境 API 依赖反应式运行时；跨线程误用时的具体失败模式将在实现时核对。

### 2.3 数据目录与配置

NSH 0.5 发行说明写明 `data_dir()` 提供应用自己的数据目录；TSX 侧有 `process.dataDir`，`nsh.json` 的 `capabilities.fs` 可用 `${dataDir}`。见 [0.5.0 release notes](https://nsh.dev/releases/) 与 [Standard modules](https://nsh.dev/modules/standard-modules.md)。官方 OTA 文档的本地试验示例把包放在 `~/Library/Application Support/<bundle-id>/updates`，可视为 macOS 数据目录形态的旁证，见 [OTA Updates](https://nsh.dev/docs/ota-updates.md)。本应用 `data_dir()` 的精确路径将以实现时的实际返回值为准。

持久化约定：

- `config.json`（或同等文件）只存目标文件夹路径、窗口偏好、设备显示名等小配置，使用原子写入（先写临时文件再替换）。
- 照片索引使用 SQLite，单独存放，见第 5 节与第 6 节，避免把大型索引塞进一份配置文件。
- 数据目录不保存用户原片。原片只出现在用户选定的目标文件夹中。
- 评分与标记的权威副本之一是目标文件夹里的 XMP sidecar；SQLite 保存同一数据的镜像，供筛选使用。

无 `capabilities` 键的独立应用在官方沙箱说明中对本地文件更宽松；一旦声明 `capabilities`，本地 `file:` 图像也必须落在 `fs.read` 根内，见 [Image](https://nsh.dev/elements/image.md)。实现时将明确选择：保持无 capabilities 的独立应用，或声明根目录并始终把用户目标文件夹加入可读范围。这一选择将在实现时验证。

---

## 3. 相机连接方案

### 3.1 官方能力与社区协议

官方产品把无线传图放在智能手机上的 Image Sync：先在相机上打开无线局域网，再在手机上选 SSID 并输入相机 LCD 上的密码；部分系统还要求定位权限才能读取 SSID 列表。蓝牙配对出现在官方 Image Sync 与 GR III / GR IIIx 的说明中。见 [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html)。官方未发布给第三方 Mac 应用使用的 HTTP SDK。

社区在固件与 Image Sync 上逆向出一套 HTTP API：相机作为接入点，地址多为 `http://192.168.0.1/v1`（另有型号使用 `192.168.1.1`，社区 OpenAPI 标明主要用于 G900SE，不是 GR IIIx 的默认描述）。见 [secretsauce](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html) 与 [CursedHardware/ricoh-wireless-protocol](https://github.com/CursedHardware/ricoh-wireless-protocol)。Namako 写明连上相机 Wi-Fi 后，浏览器即可访问且未见鉴权。这些都不是官方保证，需在目标固件的真机上复核。

第一版只使用下列只读请求（名称来自社区资料，需在真机上验证）：

- `GET /v1/ping`：连通探测。
- `GET /v1/props`：只读属性，用于显示型号等（若响应里确有这些字段）。
- `GET /v1/photos`：列表。
- `GET /v1/photos/{folder}/{file}` 以及文档化的 `size` 查询：下载或预览。
- `GET /v1/photos/{folder}/{file}/info`：元数据（可选）。

第一版明确不调用社区资料中的 `POST /v1/device/finish`、`POST /v1/device/wlan/finish`、拍摄与对焦接口，以及 `PUT /v1/params/…`。`PUT /v1/photos/{folder}/{file}/transfer` 可能在机身标记传输状态，第一版默认不调用。以后若要加入，需要变更范围并在真机上验证其副作用。

### 3.2 第一版连接方式（已决定）

**已决定：** 第一版在首次连接时保存相机配置，之后自动切换 Mac 的 Wi-Fi。这取代了此前「第一版只支持手动加入相机网络」的决定。相机 HTTP 源地址默认仍是 `http://192.168.0.1`，开发或地址特殊时仍可配置。

加入网络的首选机制是 `/usr/sbin/networksetup -setairportnetwork`；在权限允许时用 `/usr/sbin/networksetup -getairportnetwork` 读取当前 SSID；用 `/sbin/route -n get 192.168.0.1` 判断该路由是否经过 `utun`（或类似）接口。这比把 [Core WLAN](https://developer.apple.com/documentation/corewlan) 的 `associateToNetwork:password:` 作为主路径更可靠，因为 CoreWLAN 加入网络通常要先扫描，而在较新的 macOS 上扫描受定位服务限制。`networksetup` 可以用已知的 SSID 和密码直接加入，不必先扫描。切回原来的网络使用同一工具和记住的 SSID，不为原网络保存密码，而是依赖该网络已在 macOS 的偏好网络列表中。

Apple DTS 在开发者论坛写明：从特定系统版本起，读取当前 SSID 需要定位权限（`CWInterface` 头文件注释；[forums thread 732431](https://developer.apple.com/forums/thread/732431?answerId=758114022)）。在 macOS 14 及以后，`networksetup -getairportnetwork` 也受同一限制。因此应用在 `nsh.json` 的 `macos.infoPlist` 中声明 `NSLocationUsageDescription` 和 `NSLocationWhenInUseUsageDescription`，由 NSH 写入打包后的 Info.plist（见 [Packaging](https://nsh.dev/docs/packaging.md)）。定位权限只用于首次保存配置时读取当前 SSID。若用户拒绝授权，仍可手动输入相机屏幕上的网络名称。应用不申请 `com.apple.developer.*` 权限或钥匙串访问组，因为这些需要描述文件，个人 ad hoc 签名应用无法使用。

Wi-Fi 密码通过 `security-framework` 以通用密码写入 macOS 钥匙串（服务名 `com.yunkou.ricoh-mac.camera-wifi`），并抽象为 `SecretStore`。配置元数据以 JSON 保存在应用数据目录，文件中不含密码。自动化测试使用内存密码库和伪造的 Wi-Fi 控制器，不得调用 `networksetup -setairportnetwork`。开发时设置 `RICOH_MAC_NO_WIFI_SWITCH` 也可阻止生产控制器切换网络。

蓝牙唤醒 Wi-Fi 出现在社区可行性讨论中，官方 Image Sync 也描述了手机端蓝牙配对。第一版不把它列为验收项。

---

## 4. 导入流程

**已决定：** 所有导入文件放入用户选定的同一个目标文件夹，并保留相机原始文件名。导入仍先写临时文件，校验完整后再改名为最终文件，并沿用现有去重策略。

流程：

1. 用户用 `pick_paths(OpenDialog::folders())` 选定目标文件夹（见 [Building with Rust](https://nsh.dev/docs/rust.md)）。该文件夹同时是本地相册根目录。
2. 应用拉取相机列表，用缩略图浏览（`size` 参数以真机结果为准）。
3. 用户选择要导入的文件。应用在目标文件夹内用相机原始文件名计算目标路径，并检查是否已有完整副本。
4. 下载写入同一目录下的临时文件（例如 `R0001234.DNG.partial`），必要时按 HTTP 范围或已有字节续传。完整下载并校验长度（若有 `Content-Length` 或已知大小）后，再原子改名为最终文件。
5. 将记录写入本地 SQLite 索引：原路径、目标路径、大小、校验和、导入时间、相机文件名。

去重：当目标路径已存在，且大小（及可选校验和）一致时，视为同一文件并跳过。不要仅靠文件名在其他目录里做去重。若两个来源文件会落到同一文件名但内容不同，必须报告冲突，不得覆盖已有的完整原片。这是「全部放入同一文件夹并保留原文件名」这一决定的直接后果。

HTTP Range 是否被相机支持，需在真机上验证。若不支持，续传应改为丢弃不完整的临时文件并重新下载，同时仍跳过已完整的最终文件。

官方说明还提到：建立无线连接或传图时，相机会抑制自动关机；USB 连接期间无线不可用。见 [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html)。应用应在导入说明里提示这些限制。

---

## 5. 本地相册与索引

本地相册的权威数据是用户磁盘上的文件。应用索引是加速层，不是唯一真相。

约定：

- 扫描范围是目标文件夹内的直接照片文件。第一版不再按日子目录分层，也不进入子文件夹。原生 `Library.listPhotos` 接口为只读：不会在该文件夹中创建、改写、移动或删除文件。
- 索引保存在 `data_dir()` 下的 SQLite，字段包括相对路径、文件名、扩展名、字节大小、可选校验和、拍摄时间（若能从 EXIF 或 `info` 得到）、星级（1 到 5，或未评分）、标记（已选、排除，或无标记）、导入来源。
- 选择 SQLite 是因为筛选、排序和增量更新比单份 JSON 更容易保持一致，也便于以后加字段。
- 当索引与目录不一致时，以磁盘为准：刷新会补入新文件、移除已不存在的路径，但不得删除磁盘上的原片。sidecar 若存在，刷新时应与索引对账。
- 缩略图缓存可以放在 `data_dir()` 下，按内容哈希或路径加修改时间索引，缓存丢失时可以重建。

JPEG 与 PNG 的显示优先走 NSH `Image`。官方 [Image](https://nsh.dev/elements/image.md) 说明源可以是 URL、资源、`data:` 或 `blob:`；并写明在桌面上，绝对路径或 `file:` URL 在 `fs.read` 覆盖该路径时可以加载。NSH `Image` 是否直接解码 DNG，文档未写明，需再验证。不要对巨大文件做无界的 base64 内联。

---

## 6. 选片评分与标记的存储

**已决定：** 同时写入 XMP sidecar 和本地 SQLite 索引。星级为 1 到 5 星。标记为已选、排除。

具体约定：

- 在导入文件旁写入 sidecar（实现时按常见工具对齐文件名形态，例如 `R0001234.xmp` 或 `R0001234.DNG.xmp`），使用标准字段如 `xmp:Rating`；已选与排除用明确的 sidecar 字段表示，字段名将在实现时选定并写入文档。
- 同一数据镜像到 SQLite，供列表筛选与排序。
- 不改 JPEG 或 DNG 的像素，也不写入这些原片内部的元数据包。
- 相机上的文件不写 sidecar，也不通过无线回写评分。
- 改星级或标记时，sidecar 与索引必须一起更新。若sidecar 丢失，应用仍可暂用索引工作，并在安全的前提下提示重建 sidecar。
- 未采用「只存在应用数据库」的方案，以免其他工具看不到标记，也避免只丢数据目录时标记全部消失。未采用「写入图像文件内部」的方案，因为它会改写原片字节。

`xmp:Rating` 的语义以 Adobe XMP 文档为准，见 [XMP xmp namespace](https://developer.adobe.com/xmp/docs/XMPNamespaces/xmp/)。与 Lightroom 或其他工具的往返兼容性，以及 sidecar 文件名形态，需再验证。

---

## 7. RAW / DNG 预览方案

官方记录格式是 14-bit DNG，可与 JPEG 同时记录。见 [FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html)。

第一版对已经在本地的 DNG，推荐使用文件内嵌 JPEG 或 ImageIO 缩略图，而不是完整 demosaic 冲图。在 macOS 上可通过 ImageIO（可用 `objc2` 绑定调用 `CGImageSource` / `CGImageSourceCreateThumbnailAtIndex`）读取内嵌预览或生成缩略图，再交给界面显示。官方概念说明见 [Creating and Using Image Sources](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/ImageIOGuide/imageio_source/ikpg_source.html)，API 见 [Image I/O](https://developer.apple.com/documentation/imageio)。

理由：选片需要的是及时、稳定的可视图，而不是最终颜色；内嵌预览通常已存在于相机 DNG 中，解码成本低，且不修改文件。完整 RAW 解码放入后续版本。

也可以探测把 DNG 路径直接交给 NSH `Image`。若运行时用 ImageIO 且恰好能显示，成本最低；但官方 Image 文档没有列出 DNG，行为需再验证。即便可行，也应对失败提供回退。

预览结果可缓存在 `data_dir()`，不要写回 DNG。EXIF 方向是否总被应用，需再验证。`objc2` 与 ImageIO 在 NSH mixed 包中的链接方式、以及沙箱对本地文件读取的影响，将在实现时验证。

**待真机验证：** 若无线不能传输 DNG，第一版是否仍以已经在本地的 DNG（例如从存储卡拷入目标文件夹）满足 RAW 预览需求。此项留在第 10.2 节，将在真机验证后决定。

---

## 8. 测试策略

- **Rust 单元测试：** 用临时目录和本机临时 HTTP 服务覆盖路径校验、原子写入、去重、同名冲突、断点文件、索引刷新，以及 sidecar 与 SQLite 的同步。不要访问用户真实相册或真实配置。
- **协议夹具：** 把已核对的示例 JSON 与二进制（自造的小 JPEG / 最小 DNG 夹具）放在测试目录。在真机验证后，可以用匿名化的真实响应更新夹具，但仍不要提交用户原片。
- **NSH UI 测试：** 使用官方 `nsh test` 无界面引擎和 `modules` 替身（若目标平台允许）。官方说明：无界面 `open()` 的能力与 `data_dir` 行为以当时文档为准；`modules` 在真实 `macos` 目标上可能不可用，需在测试说明里区分无界面与 `nsh test --target macos`。见 [CLI](https://nsh.dev/docs/cli.md) 与 [macOS](https://nsh.dev/docs/macos.md)。
- **真机测试（手动）：** 连接、列表、缩略图尺寸参数、JPEG 与（若可用）DNG 导入、中断续传，以及无线无法传输 DNG 时的预览策略。不把脚本驱动 GUI 当作默认 CI。
- 持续集成只跑单元测试与无界面 UI 测试，不连接真实相机。

---

## 9. 构建、打包与签名

日常命令（官方 [CLI](https://nsh.dev/docs/cli.md)、[macOS](https://nsh.dev/docs/macos.md)、[Packaging](https://nsh.dev/docs/packaging.md)）：

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

`nsh package --target macos` 在 `.nsh/out/` 写出 `.app`，官方说明该包是 **ad hoc 签名**，需要 macOS 14 或应用声明的更高版本。见 [Packaging：macOS](https://nsh.dev/docs/packaging.md)。构建本机 runners 需要 Xcode Command Line Tools（`codesign`、`sips` 等），见 [macOS](https://nsh.dev/docs/macos.md)。

**已决定：** 第一版仅供个人使用。采用上述 ad hoc 签名即可。不做 Developer ID 签名，也不做公证。对外分发安装包不在第一版范围内。官方文档中「分发给其他机器需再用 Developer ID 签名并公证」的路径，对本项目的第一版不适用。

`nsh.json` 的 `id` 必须是合法的反向域名形式；官方会对 `com.example.` 占位符发出警告。见 [Packaging](https://nsh.dev/docs/packaging.md)。个人使用时的具体 id 见需求文档「开放问题」。占位符不得作为最终身份。

`nsh publish` 与 `.nshpkg` 是给宿主加载的签名包，与用户可安装的 `.app` 不是同一件事。见 [Signed Packages](https://nsh.dev/docs/signed-packages.md)。第一版以 `nsh package --target macos` 在本机制包为主。

不要在仓库中提交签名密钥、公证凭据或 `.secret` 文件。

---

## 10. 风险与待验证事项

### 10.1 风险

- 无线协议来自社区逆向，固件升级后可能变化，且 Ricoh 没有对第三方客户端做出承诺。
- 社区对预览 `size` 参数的描述不一致，实现若写死错误参数，会导致缩略图失败或下到过大的原图。
- 若无线不能传 DNG，第一版「导入相机照片 + RAW 预览」的组合如何满足，将在真机测试后决定。
- 全部文件放入同一目标文件夹并保留原文件名时，不同拍摄日期下的同名文件可能冲突，必须报告而不得覆盖。
- ad hoc 签名的 `.app` 在其他 Mac 上可能被 Gatekeeper 拦截。第一版不对外分发，因此这不是第一版验收项，但本机以外的拷贝仍可能受影响。

### 10.2 待真机或运行时验证

除需求文档第 9 节列出的相机事项外，还包括：

- 若无线不能传输 DNG，第一版是否仍以已经在本地的 DNG（例如从存储卡拷入目标文件夹）满足 RAW 预览需求。此项将在真机验证后决定。
- NSH `Image` 是否直接显示本地 DNG；`file:` 路径在有无 `capabilities` 时的行为。
- `data_dir()` 在本应用 bundle id 下的精确路径。
- `blocking` 内外调用 `data_dir()` 或其他环境 API 的约束。
- ImageIO 对 GR IIIx DNG 内嵌预览的兼容性、方向，以及 `objc2` 链接。
- 相机是否支持 HTTP Range 续传。
- XMP sidecar 与常用软件的互操作，以及应采用的文件名形态。
- `nsh package --target macos` 在本机的 ad hoc 签名结果，以及该包在本机运行是否足够（第一版不做公证）。

---

## 11. 主要来源

NSH（官方）：

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

理光官方：

- [RICOH GR IIIx Operating Manual (PDF)](https://www.ricoh-imaging.co.jp/english/support/man-pdf/gr-3x.pdf)
- [GR III / GR IIIx FAQ](https://www.ricoh-imaging.co.jp/english/support/qa/gr-3/index.html)
- [Image Sync connection method](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/connect.html)
- [Image Sync functional explanation](https://www.ricoh-imaging.co.jp/english/products/app/image-sync2/manual-00.html)

社区无线协议：

- [secretsauce GR IIIx 802.11 note](https://notes.secretsauce.net/notes/2022/06/16_ricoh-gr-iiix-80211-reverse-engineering.html)
- [dkogan/ricoh-download](https://github.com/dkogan/ricoh-download)
- [Namako GR3x wireless API](https://namako.tw/2024/05/11/gr3x-wireless-api/)
- [CursedHardware/ricoh-wireless-protocol](https://github.com/CursedHardware/ricoh-wireless-protocol)
- [snmkl/ricoh.app](https://github.com/snmkl/ricoh.app)

Apple 与元数据：

- [Core WLAN](https://developer.apple.com/documentation/corewlan)
- [Requesting authorization to use location services](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)
- [Apple Developer Forums thread 732431](https://developer.apple.com/forums/thread/732431?answerId=758114022)
- [Image I/O](https://developer.apple.com/documentation/imageio)
- [Creating and Using Image Sources](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/ImageIOGuide/imageio_source/ikpg_source.html)
- [Adobe XMP xmp namespace](https://developer.adobe.com/xmp/docs/XMPNamespaces/xmp/)

---

## 12. 第一里程碑实现说明

第一里程碑使用的工具链是 **NSH 0.5.1**（`nsh 0.5.1 (224d9a7)`），通过官方 `install.sh` 安装，并锁定在 0.5.x 稳定系列。`Cargo.toml` 依赖 `nsh-core` 与 `nsh-base` 0.5.1。

mixed 应用放在仓库根目录：

- `App.tsx` 是 Native Shell 约定的 TSX 入口：它与 `nsh.json` 同级，只负责挂载应用。界面代码在 `ui/` 中。`ui/App.tsx` 负责组合外壳；`ui/components/` 存放视图；`ui/state/` 存放信号与流程；`ui/lib/` 存放缩略图加载器等辅助模块。应用采用固定深色和暖琥珀强调色，不放产品名大标题，也没有常驻侧栏。角落的圆形按钮只打开设置。照片以 `List` 的 `numColumns` 做成虚拟化缩略图网格。视觉 token 在 `ui/theme.ts`，文案在 `ui/copy.ts`，选择逻辑在 `ui/state/selection.ts`，界面图标在 `ui/assets/icons/`（Kubai Icons 0.9.0，MIT 许可，已固化的官方 color 变体，主按钮使用单色 on-accent 图形；见 `ui/assets/icons/SOURCE.txt`）。设计说明见仓库根目录的 `DESIGN.zh-CN.md` 与 `PRODUCT.zh-CN.md`。
- `src/lib.rs` 向 TSX 导出 Rust 模块，说明符为 `ricoh-mac/native`：`Library`、`Camera` 与 `Wifi`。
- `src/config.rs` 把保存位置和相机源地址保存在 `data_dir()` 下的 `config.json` 中，先写临时文件再原子改名。
- `src/camera.rs` 是只读 HTTP 客户端：`GET /v1/ping`、`GET /v1/props`、`GET /v1/photos`、原文件下载，以及可选的 `size=thumb`。不发送 POST 或 PUT。默认源地址是 `http://192.168.0.1`，可在界面中改为开发地址。
- `src/importer.rs` 把文件写入同一个保存位置，保留原始文件名，使用 `.partial` 临时文件，跳过名称与大小都相同的文件，并在同名冲突时报告且不覆盖。
- `src/mock_camera.rs` 与 `src/bin/mock-camera.rs` 提供本地 HTTP 夹具，用于测试，以及在没有相机时调试界面。

耗时的 HTTP 与文件操作在 `blocking()` 中执行。`data_dir()` 在异步模块函数中、在进入这些工作之前读取。选择文件夹使用 `pick_paths(OpenDialog::folders())`。

测试：`nsh test` 运行 Rust 单元测试和夹具测试（ping、列表、下载、去重、不完整下载恢复、相机不可达），以及无界面 UI 测试。UI 测试通过 `open` 的 `modules` 替换 `ricoh-mac/native`，覆盖首次启动、连接后自动列出、选择、导入禁用态和进度摘要，不读取用户的真实保存位置或配置。这些测试不能代替真机验证。

开发命令：

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
cargo run --bin mock-camera
```

模拟服务器默认地址是 `http://127.0.0.1:8080`。在应用中把相机源地址设为该地址，即可在不加入相机 Wi-Fi 的情况下练习列表和导入。相机接口与 JSON 形状仍需在理光 GR IIIx 真机上验证。
