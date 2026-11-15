# GR IIIx 拍摄信息核对

日期：2026 年 11 月 15 日，Asia/Shanghai。

本文记录用可公开下载的、机内直出的理光 GR IIIx JPEG 与 DNG，对本应用标准 Exif 与 MakerNote 读取的核对。核对范围是产品规划中拍摄信息面板所列字段：机身型号、裁切（未裁切 40 mm，裁切 50 mm 或 71 mm）、图像设定、Snap、全按快门 Snap、ND 滤镜和色温。

原片样本不放入本仓库。本文与已提交的夹具均不包含序列号、GPS 坐标或摄影师个人信息。

## 查阅过的来源

以下来源均为公开信息。未注册付费服务，也未绕过站点封锁。未扫描开发机器上的私人照片目录。

| 来源 | 结果 |
| --- | --- |
| [raw.pixls.us](https://raw.pixls.us/) 样本库 | 一份 GR IIIx 14 位 DNG，以 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 发布。已使用。 |
| Imaging Resource [GR IIIx 样张](https://www.imaging-resource.com/cameras/ricoh-gr-iiix-review/samples/) 与 [图库](https://www.imaging-resource.com/cameras/ricoh-gr-iiix-review/gallery/) | 按站点 [旧版使用说明](https://old.imaging-resource.com/USAGE.HTM) 与 [使用条款](https://www.imaging-resource.com/terms-of-use/)，工作室 DNG 与一张图库 JPEG 可下载供本地、私人、非商业评估。仅在本地使用，不传播，不提交仓库。 |
| Imaging Resource 工作室 “FULLRES” JPEG `GR3xhSLI000100NR0.JPG` | 当前提供的是一幅 6 000 × 4 000 的 JFIF，几乎没有 Exif 或 MakerNote。未用于 MakerNote 核对。 |
| Imaging Resource 图库中 `Y-WB-GRIIIx-R0000001` 对应的 DNG | 对应 DNG 地址返回 HTTP 404。 |
| Photography Blog 评测与样张页 | HTTP 403。未设法绕过。 |
| rawsamples.ch | 仅有较早期的 Ricoh GR / GR Digital 机身，未见 GR IIIx 原片。 |
| DPReview、PetaPixel、Popular Photography 样张库 | 作为次要线索记录。部分 DPReview 文件经过 Adobe Camera Raw 转换。在已获得许可清楚的机内 JPEG 与 DNG 后，未再下载。 |

Imaging Resource 公开图库中列出的照片均为 6 000 × 4 000 或 4 000 × 6 000、镜头 26.0 mm，未见公开的 50 mm 或 71 mm 裁切原片。

## 仅保存在本地的开发文件

这些文件只放在开发缓存目录中，不进入仓库：

`/Users/coco/Library/Caches/ricoh-mac/gr-iiix-samples/`

| 文件 | SHA-256 | 许可 / 使用范围 | 型号证据 |
| --- | --- | --- | --- |
| `pixls-us/Ricoh - GR IIIx - 14bit (3:2).DNG`（31 357 843 字节） | `1e318af31be4baa9949f0ed4af5cfe8ffb2c180e2c12926cd75ac1d029bb0fae` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。来源：[raw.pixls.us 文件 5818](https://raw.pixls.us/getfile.php/5818/nice/Ricoh%20-%20GR%20IIIx%20-%2014bit%20(3:2).DNG)。 | IFD0 / UniqueCameraModel 为 `RICOH GR IIIx`，软件版本 `RICOH GR IIIx Ver. 1.02`。下载的 SHA-256 与 raw.pixls.us 公布值一致。 |
| `imaging-resource/GR3xhSLI000100NR0.DNG`（34 280 956 字节） | `96638377c5f49f14074491f67fe2d34a9381048e74b30997d651eaf7854f54f4` | 仅限 Imaging Resource 规定的本地、私人、非商业评估，不得再发布，不得提交仓库。来源：[FULLRES DNG](https://www.imaging-resource.com/PRODS/ricoh-gr-iiix/FULLRES/GR3xhSLI000100NR0.DNG)（由站点 media/legacy 主机提供）。 | IFD0 型号 `RICOH GR IIIx`，软件版本 `RICOH GR IIIx Ver. 1.00`。机内直出工作室 RAW（文件名后缀 `NR0`）。 |
| `imaging-resource/Y-WB-GRIIIx-R0000001.JPG`（14 288 082 字节） | `9c57fbb94fa66b5e087d5e83a5643bcf46ac952730bacd880339bbb60d795af1` | 使用范围同上。来源：[FULLRES JPEG](https://old.imaging-resource.com/PRODS/ricoh-gr-iiix/FULLRES/Y-WB-GRIIIx-R0000001.JPG)。 | IFD0 型号 `RICOH GR IIIx`，软件版本 `RICOH GR IIIx Ver. 1.00`。4 000 × 6 000 的机内 JPEG，含完整 MakerNote。 |

## 方法

不编造字段期望。标签名称与取值枚举来自 ExifTool 公开的 [Ricoh](https://exiftool.org/TagNames/Ricoh.html) 与 [Pentax](https://exiftool.org/TagNames/Pentax.html) 说明，再与上述文件上的 ExifTool 13.55 输出，以及本 crate 中的 `inspect_photo` 逐项对照。ExifTool 仅作为开发机上的核对依赖临时安装，不打包进应用。

## 实拍文件中的布局

ExifTool 的 Ricoh 表（`CropMode` 0x1018 为关 / 35 mm / 47 mm，`ImageEffects` 0x1010 及同类 0x10xx 标签）**不是**此次所核 GR IIIx 文件实际写入的布局。

JPEG 的 MakerNote（Exif 标签 0x927C）与 DNG 的 MakerNote（TIFF/DNG 标签 0xC634，`DNGPrivateData`）均以 `RICOH\0` 开头，后接字节序标记 `II` 和 IFD 条目数，没有 TIFF 魔术数 42，也没有 4 字节 IFD 偏移。ExifTool 13.55 将该 IFD 解码为 Pentax 标签。kamadak-exif 不暴露 0xC634，因此 DNG 需要另行读取该标签。

此前的解析只跟随 Exif 标签 0x927C，并在 `Ricoh` 前缀之后按标准 TIFF 头读取。面对这些实拍文件时，图像设定、对焦、ND 等 MakerNote 字段因此全部为空。这是根因缺陷，而不是文案缺失。现有解析已识别 `RICOH\0` + 字节序 + IFD 的紧凑布局，在缺少 0x927C 时读取 DNG 的 0xC634，并仅映射 ExifTool 为该 Pentax 布局 IFD 记载的、且拍摄信息面板已经展示的字段。旧的 Ricoh 0x10xx 映射予以保留，以继续支持现有合成夹具以及仍使用该布局的文件。解析不会扩展成通用的 Pentax 解码器，也不会从 MakerNote 中读取序列号或 GPS。

## 逐项实拍覆盖

下列结论仅限于上述三份合法样本，**不能宣称全覆盖**。

| 字段 | 实拍覆盖 | 非敏感证据 | 仍未验证 |
| --- | --- | --- | --- |
| 机身型号 | JPEG 与 DNG 均已验证 | 三份文件均为 `RICOH GR IIIx` | 仅覆盖上文所列固件（1.00 与 1.02） |
| 未裁切 / 40 mm | 已验证 | 标准 Exif `FocalLengthIn35mmFormat` 为 40 mm；像素为 6 000 × 4 000 或 4 000 × 6 000；Pentax `AspectRatio` 为 3:2 | — |
| 裁切 50 mm 与 71 mm | 未验证 | 未找到 35 mm 换算为 50 mm 或 71 mm 的公开原片。ExifTool 未对这些文件中的 `0x0098` 给出面向 GR IIIx 的 50/71 映射。当型号为 GR IIIx 且不存在 Ricoh `CropMode` 标签时，应用可依标准 35 mm 换算（40 / 50 / 71）推断裁切。其中 50 mm 与 71 mm 分支尚未经裁切原片确认。 | 裁切原片；能够区分 50 mm 与 71 mm 的 MakerNote 裁切标签 |
| 图像设定 | 仅验证了“标准”和“单色” | 按 ExifTool 的 Pentax 表，`ImageTone` 256 为标准（工作室 DNG 与图库 JPEG），258 为单色（pixls.us DNG） | 鲜艳、正片以及其余已记载的 256–267 取值 |
| 对焦（含 Snap） | 已验证手动、自动区域、选择对焦 | Pentax `FocusMode` 3 为手动，6 为自动区域，8 为选择对焦 | 同表中的 Snap（`0x0C`）未在这些文件中出现 |
| 全按快门 Snap | 未验证 | 这些 MakerNote 中没有 Full Press Snap 标签 | 记录了该设定的文件 |
| ND 滤镜 | 仅验证了关闭 | Pentax `NeutralDensityFilter` 中 `0 0` 为 Off (Off)，`0 2` 为 Off (Auto)。应用按首字节记录开关，与 ExifTool 记载的取值对相符 | ND 开启（`1 1` / `1 2`） |
| 色温 / 开尔文白平衡 | 未验证 | `ColorTemperature` 为 0，白平衡为多重自动或手动，不是开尔文 | 以开尔文白平衡拍摄、色温在 1 000–20 000 K 之间的文件 |

白平衡的“多重自动”和“手动”已出现，并与 ExifTool Pentax `WhiteBalance` 表中的 14、5 相符，现已显示。它们不是本项点名的核对目标，其余白平衡预设仍未经 GR IIIx 实拍确认。

## 测试

行为测试覆盖紧凑的 `RICOH\0` 布局、依据 ExifTool 的 Pentax 标签映射、JPEG Exif MakerNote、DNG 的 0xC634，以及未裁切 40 mm 的裁切推断。旧的 Ricoh 0x10xx 布局测试仍然通过。若上述三份缓存文件存在且大小与记录一致，`public_gr_iiix_samples_match_verified_facts_when_present` 会通过 `inspect_photo` 核对同样的非敏感事实。原片只被读取。

## 关于完整 RAW 与直方图的说明（未实现）

本节只为后续事项提供证据，并不实现 RAW 显影。

在本开发用 Mac（macOS 27.0.1，内部版本 26A434）上，`CIRAWFilter.supportedCameraModels` 列出 917 个型号，其中包括 `PENTAX RICOH GR`、`PENTAX RICOH GR II` 和 `PENTAX RICOH GR III`，**没有**列出 GR IIIx。

尽管型号表中没有 GR IIIx，`CIRAWFilter(imageURL:)` 仍能打开 pixls.us 的 CC0 GR IIIx DNG，得到 6 000 × 4 000 的输出图像，并对 8 × 8 的裁切块完成软件渲染。DNG 本身带有校准矩阵，因此即使支持列表中没有该型号，Core Image 仍可能显影该文件。这只是一次运行时观察，并不表示所有 IIIx DNG 或所有 macOS 版本都会如此。

Core Image 与 ImageIO 是随 macOS 分发的系统框架，适用苹果软件许可。应用可以作为普通系统依赖链接它们。不得再分发 Apple SDK，本工作也不把苹果头文件或二进制收入仓库。后续若用 Rust 桥接，较稳妥的做法是用一小段 Swift（或 Objective-C）辅助代码调用 `CIRAWFilter`，再通过狭窄的 FFI 返回位图或直方图数据，而不是在 Rust 中重写苹果的解码器。

该项后续工作应以缓存目录中 pixls.us 的 CC0 DNG 作为许可清楚、可再分发的本地样本。Imaging Resource 的 DNG 可按站点条款再做私人本地核对，但不得提交或公开传播。

