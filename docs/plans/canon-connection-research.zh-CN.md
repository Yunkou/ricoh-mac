# 佳能相机的连接方式：调研与在本项目中的位置

本文回应「内测摄影师使用佳能相机，如何连接」这一问题。资料于 2026 年 11 月 16 日至 17 日（Asia/Shanghai）查阅，对照的是仓库当前 `v0.3.2`（提交 `d3cd70e`）的实现。这是调研记录，不是实施计划，也不承诺工期。本文不修改 [next-features.zh-CN.md](next-features.zh-CN.md)、[requirements.zh-CN.md](../requirements.zh-CN.md) 中已经确认的决定；若冲突，以那些决定为准。

引用均为短句并给出 URL。部分厂商页面要求注册或对普通抓取返回 403，正文已在同日读到；未能读到正文的来源不引用其内容。

## 结论

佳能相机可以连，但它与理光 GR IIIx 不是同一种缺口。理光官方只把无线导入给手机，桌面是空白；佳能为 Mac 提供了官方通路（USB 线缆、EOS Utility、Image Transfer Utility 2、image.canon），只是这些工具陈旧或需要注册。因此：

- **让内测摄影师当天用上**，不需要本项目写一行连接代码。USB 线缆加系统「图像捕捉」即可拿到 CR3 与 JPEG；需要无线时，用官方 EOS Utility。
- **把佳能接进本项目的无线协议**，是另一件事，且被三道硬门槛挡住：Canon 的 API 只对法律实体开放、多数机型需要先做一次机身激活、以及本项目目前根本读不了 CR3。

## 证据矩阵

| 来源 | 内容 | 与本项目的关系 | 证据强弱 |
| --- | --- | --- | --- |
| [Canon 亚洲：Camera API Package 概览](https://asia.canon/en/campaign/developerresources/cap) | CCAPI 是 HTTP/1.1 + UPnP 的接口，可通过 Wi-Fi 或有线局域网访问，版本 1.4.0。原文写：「The Applicant must be a legally registered entity」，并明确学术申请必须由机构提出、「not by students or academic personnel in their personal capacity」。该页只受理所列出的约十余个国家/地区。原文另写 CCAPI 覆盖「15 types or more in the EOS/PowerShot Series」，且只有 EOS-1D X Mark III 与 EOS R3 支持有线局域网控制。 | 个人开发者、以及「面向个人用户的开源应用」按字面不属于该申请的合格主体。这不是技术问题，而是获取条件问题。 | 强（官方页，已读到正文） |
| [Canon 日本：SDK Camera API Package](https://personal.canon.jp/product/camera/software/api-package) | 原文写：「Camera Control APIをご利用いただくには、カメラ本体の機能追加（アクティベーション）が必要になります。」「アクティベーション対象機種」含 EOS-1D X Mark III、R3、R5、R6、R6 Mark II、R7、R8、R10、R50、R100、90D、Kiss X10i、Kiss X10、RP、Kiss M2、M200、G5 X II、G7 X III、SX70 HS；「アクティベーション非対象機種」为 R1、R5 Mark II、R50 V、R6 Mark III、R6 V、PowerShot V10。工具价格写为「無償」，但须通过申请表获取。 | 意味着即使拿到接口，多数在售机身的菜单里默认没有 CCAPI 入口，必须先用 USB 跑一次官方激活工具。内测摄影师的机身型号直接决定这条路径是否可行。 | 强（官方页，已读到正文） |
| [Canon：CCAPI Operation Guide（PDF）](https://downloads.canon.com/sdk/CameraControlAPI_OperationGuide_EN.pdf) | 该 PDF 的正文本次未能抽取，故不引用其内容。 | 只作为「官方文档确实存在、但以开发者注册为前置」的旁证。 | 弱（未读到正文） |
| [EOS Utility 产品页](https://app.ssw.imaging-saas.canon/app/en/eu.html?region=1) | 当前版本 3.21.11，支持「macOS 26 / 15 / 14」。机型表含 R1、R3、R5、R5 Mark II、R6、R6 Mark II、R6 Mark III、R7、R8、R10、R50、R50 V、R100、RP 等。 | 官方桌面无线通路仍在维护，且比 Image Transfer Utility 2 更新。需要无线时可优先推荐这一条。 | 强（官方产品页，已读到正文） |
| [EOS Utility 3.x Wi-Fi 传图步骤](https://th.canon/th/support/8204189300) | 相机端选「Remote control (EOS Utility)」→「Register a device for connection」，记下 SSID 与密码；电脑加入该 SSID；相机上确认配对；在 EOS Utility 里选「Pairing over Wi-Fi/LAN」，再「Download Images to computer」。 | 流程与理光的「连相机接入点、再走 HTTP」在形态上相似，但协议不同：佳能用 PTP 相关配对，不是可直接照搬的只读 HTTP。 | 强（官方支持页） |
| [Image Transfer Utility 2.2.30 for macOS](https://in.canon/en/support/0200726802) 与 [所需电脑环境](https://th.canon/th/support/8204116300) | 版本 2.2.30 发布于 2024 年 11 月，支持 macOS 13–15；CPU 要求写作「Intel Core 2 Duo or higher」，未见原生 arm64 说明。 | 这是「相机开机自动发图到电脑」的官方形态，但更新滞后于 EOS Utility，且未声明 Apple Silicon 原生支持。不宜作为第一推荐。 | 中（下载页强，arm64 结论为推断，未见厂商否认） |
| [image.canon：自动下载到 PC 或 Mac](https://image.canon/st/zh/auto-download.html) | 「Downloader for image.canon」支持「Windows 11 / Windows 10 / macOS 26（仅限搭载 Apple Silicon 的 Mac） / macOS 15 / macOS 14」；合格文件包括「静态图片、视频和 RAW 文件」；原文另写未在 30 天存储期内下载的文件将从帐户删除。 | 这是一条绕开局域网的官方通路，且是上述工具中唯一明确声明支持 macOS 26 与 Apple Silicon 的。代价是经云端中转，并有 30 天期限。 | 强（官方页，已读到正文） |
| [Apple：iOS 26 / macOS Tahoe 26 支持的相机 RAW](https://support.apple.com/en-us/122870) | 按机型列出，不按扩展名。列表中包含 Canon EOS R1、R3、R5、R5 Mark II、R6、R6 Mark II、R6 Mark III、R7、R8、R10、R50、R50 V、R100、RP 等。 | 系统层面的 CR3 解码是按机型逐步加入的，因此「某台佳能能拍 CR3」不等于「这台 Mac 能解这份 CR3」。可用 `CIRAWFilter.supportedCameraModels` 在运行时枚举确认。 | 强（官方支持页，已读到正文） |
| [Stack Overflow：`/contents` 只返回 100 张](https://stackoverflow.com/questions/71195748/canon-ccapi-contents-returns-100-images-only/75240588) | `GET /ccapi/ver100/contents/sd/{dir}` 每页最多 100 个条目，需要翻页；另有 `/ccapi/ver130/contents/...?kind=chunked&order=desc` 一次返回整个目录的 `path` 数组。 | 若真的实现 CCAPI 导入，「列表完整性」会是第一个要处理的工程问题，与理光 `/v1/photos` 的形状不同。 | 中（开发者问答，非厂商文档） |
| [libgphoto2：Canon PTP/IP 讨论](https://sourceforge.net/p/gphoto/mailman/gphoto-devel/thread/20140216130014.GB14038%40suse.de/) 与 [INDI：Canon EOS-M 支持](https://www.indilib.org/forum/ccds-dslrs/5597-canon-eos-m-cameras-support/46706.html) | gphoto2 有 `ptpip:` 传输（默认 TCP 15740），但 Canon 的无线配对需要在设置里手填 GUID；邮件列表记录「传一次成功、下一次失败」，INDI 论坛写「wifi connection option still is not supported on gphoto2」。libgphoto2 的机型表覆盖 R6、R7、R10、R3、R6 II、R8、R50、R100、R5 II、R1、R6 III 等，走的是 USB PTP。 | 说明第三方的、不要授权的方式在 Canon 无线侧并不成熟。USB PTP 则是稳定且被广泛实现的。 | 中（开发者社区，非厂商文档） |
| [macOS 多机 USB 的问题与 `ptpcamerad`](https://eclipseclick.com/blog/macos-multi-camera-usb-challenges/) | `ptpcamerad` 独占 PTP 相机的 USB 接口，并为「图像捕捉」、照片与预览提供导入能力。 | 支持「USB + 图像捕捉」这条零代码通路：本机系统自带，不需要安装佳能软件。 | 中（技术博客，与已知系统行为一致） |

## Mac 上现成的四条通路

| 通路 | 形态 | 适用场景 | 备注 |
| --- | --- | --- | --- |
| USB + 系统「图像捕捉」 | 相机作为 PTP 设备出现，系统侧读取 | 只要拿到文件 | 不装任何软件；无线通常在 USB 连接时需关闭 |
| EOS Utility 3.21.11 | 官方 Wi-Fi 遥控与下载 | 需要无线、或需要遥控 | 支持 macOS 26 / 15 / 14，机型覆盖当前 R 系列 |
| Image Transfer Utility 2.2.30 | 相机开机自动发图 | 自动备份 | 2024 年 11 月后未更新，只声明 macOS 13–15 |
| image.canon + Downloader | 相机上传云端，Mac 拉取 | 相机与电脑不同网 | 原片与 RAW 保留 30 天；唯一明确声明 macOS 26 + Apple Silicon 的工具 |

结论：**内测摄影师今天就能把佳能照片拿到 Mac 上，不需要本项目介入连接。**

## 若要走 CCAPI，门槛在哪

1. **获取资格。** Canon 官网要求申请方为法律实体，并限制受理地区；日本页写工具「無償」，但仍须经申请表取得。社区有个人注册很快通过的反馈，但把这一点当成要发布的应用的依赖项，风险由项目承担。接口的使用条件以 Canon 的许可条款为准，本文不作法律判断。
2. **机身激活。** 绝大多数在售机型属于「アクティベーション対象機種」，必须先以 USB 连接电脑、在线运行官方激活工具，菜单中才会出现「Camera Control API」。免激活的只有 R1、R5 Mark II、R50 V、R6 Mark III、R6 V、PowerShot V10。
3. **接入点与路径。** 相机接入点模式下，第三方资料常写作 `http://192.168.1.2:8080/ccapi`，但官方要求以相机屏幕显示的 URL 为准。接口路径为 `/ccapi/ver100/*`，与理光的 `/v1/*` 完全不同。
4. **列表分页。** 见证据矩阵中的 100 条上限。
5. **RAW 是 CR3，不是 DNG。**

## 本项目目前的实际缺口

以下都是仓库内可直接核对的事实，说明「接佳能」的成本主要不在连接层：

- **CR3 不会出现在相册里。** `src/album.rs:28` 的 `is_listed` 只接受 `jpg`、`jpeg`、`png`、`gif`、`webp`、`tif`、`tiff`、`heic`、`heif`、`bmp`、`dng`。
- **格式分类不认 CR3。** `src/metadata/mod.rs:126` 只把 `jpg`/`jpeg` 归为 `jpeg`、`dng` 归为 `dng`，其余一律 `other`。
- **RAW 显影被 DNG 硬限制。** `src/metadata/raw.rs:46` 的 `is_dng` 与 `:133` 的「只有 DNG 才能从 RAW 显影」。底层 `CIRAWFilter` 本身能处理 CR3，限制来自这一层的判断，而不是系统能力。
- **嵌入预览提取基于 TIFF/IFD 遍历。** `src/metadata/preview.rs` 按 TIFF 结构找嵌入 JPEG；CR3 是 ISO BMFF 容器，这条路径对 CR3 不成立，需要改走 `CIRAWFilter`。
- **MakerNote 只认理光/Pentax 布局。** `src/metadata/makernote.rs` 是 GR III / IIIx 专用读取器（`RICOH\0` + 端序 + IFD 计数），对佳能文件会返回空。详情页的拍摄信息面板对佳能只能显示标准 Exif。
- **连接层是理光专用协议。** `src/camera.rs` 全部是 GR 的 `/v1/ping`、`/v1/props`、`/v1/photos`；`src/connect.rs:13` 把相机地址写成固定常量 `192.168.0.1`。
- **可复用的部分。** `src/wifi.rs` 的「加入指定 SSID」与探测逻辑与相机品牌无关，佳能的相机接入点同样能用；`src/importer.rs` 的去重、冲突与断点续传逻辑也不依赖具体协议，前提是上层能给出「文件名 + 大小 + 下载 URL」。

## 建议与不做清单

建议按这个顺序处理：

1. **先问清机型与痛点。** 机型决定免激活还是需激活、CR3 变体是否被本机 macOS 识别；痛点决定是否需要本项目介入。
2. **立刻给出零代码路径。** 让内测摄影师用 USB + 系统「图像捕捉」把 CR3 与 JPEG 拷进一个文件夹。若他需要用本应用选片，只需要「对已有文件夹选片」的能力，而不需要连接功能。
3. **若反馈是「导入后看不了 CR3」，把它当格式工程而不是连接工程。** 改动集中在 `album.rs`、`metadata/mod.rs`、`metadata/raw.rs` 三处，预览改走 `CIRAWFilter`，MakerNote 面板对佳能留空。这条路径完全不碰 Canon 的授权条件。
4. **暂不做 CCAPI 直连。** 三条理由任何一条独立成立即可：个人开发者不符合申请主体要求；多数机型需要一次 USB 激活；它只服务佳能用户，而本产品的定位仍是理光 GR IIIx 的桌面工作流。

明确不做：

- 不把 `docs/requirements.zh-CN.md` 的目标用户改成「通用相机」。
- 不新增 EDSDK 依赖（它只走 USB/PTP，与「少插线」的初衷相反，且同样需要开发者资格）。
- 不依赖 gphoto2 的 `ptpip:` 做佳能无线导入（社区记录显示 Canon 侧配对不成熟）。
- 不把 image.canon 或任何云中转写进本应用的导入链路（会引入账号、30 天期限与上传行为，超出「本地保存位置」的既有承诺）。

## 需要内测摄影师确认的最小清单

1. 机身型号与固件版本。
2. 是否接受 USB 线缆；若只能无线，原因是什么。
3. 照片格式：只拍 JPEG、RAW + JPEG，还是只拍 CR3。
4. 若将来确认要做无线：该机型是否属于 Canon 的免激活名单。
5. 在本机验证一份真实 CR3 是否被系统识别：`mdls -name kMDItemContentType <文件>` 返回 `com.canon.cr3-raw-image` 表示识别，返回 `public.data` 表示不支持；`sips -g pixelWidth -g pixelHeight <文件>` 可进一步确认能否解码。

第 5 项必须在真机上做，不能以「macOS 支持 CR3」这一笼统说法代替。

## 与其它规划文档的关系

本文与 [product-research-next.zh-CN.md](product-research-next.zh-CN.md) 并列：那篇讨论 GR IIIx 工作流的下一步，本文讨论一个具体的内测用户与第二个品牌。本文不改变那篇的优先级建议，也不把 AI 自动选片、并排比较等候选提前。
