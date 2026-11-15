# 照片详情中的拍摄信息

本文说明在详情页中向摄影师展示哪些信息、这些信息在 GR IIIx 的 JPEG 与 DNG 中通常如何保存，以及在不解码 RAW 像素的前提下可以做到哪一步。文中描述的拍摄信息面板已经实现。标准 Exif 使用 kamadak-exif 读取。Ricoh MakerNote 字段由一小段专用解析读取。映射依据公开规格以及 ExifTool 的 Ricoh 与 Pentax 标签说明，并于 2026 年 11 月 15 日（Asia/Shanghai）对照公开的机内直出 GR IIIx JPEG 与 DNG 做过核对。实拍 IIIx 文件使用紧凑的 Pentax 布局 MakerNote；旧的 Ricoh 0x10xx 布局仍用于夹具。已验证与未验证的字段见 [gr-iiix-makernote-verification.zh-CN.md](gr-iiix-makernote-verification.zh-CN.md)。公开样本未覆盖的字段，其界面文案仍不视为最终结果。

## 要展示的信息

信息按摄影师查看照片的习惯分组，而不是按元数据标签名排列。缺省的项不显示，或标明「无」。不要把绝对路径放在第一组。

**拍摄参数**

- 光圈
- 快门速度
- ISO
- 曝光补偿
- 曝光模式（程序自动、光圈优先、快门优先、手动、快门距离优先等）
- 测光模式（多分区、中央重点、点测光、高光重点）

**镜头与构图**

- 相机型号与镜头（GR IIIx 为 18.3 mm，F2.8）
- 焦距，同时给出 35 mm 换算。未裁切时约为 40 mm；开启裁切后约为 50 mm 或 71 mm
- 裁切模式本身，便于和换算焦距对照

**色彩与对焦**

- 白平衡，以及色温（若有）
- 图像设定，对应相机中的 Image Control
- 对焦模式，并单独标出 Snap 与全按快门 Snap
- 内置 ND 滤镜（若有）

**文件**

- 拍摄日期与时间
- 格式（JPEG 或 DNG）与文件大小
- 像素尺寸与长宽比（3:2 或 1:1）
- 色彩空间（sRGB 或 Adobe RGB）
- GPS（仅当文件中存在时显示）
- 直方图

当前大图信息面板中的文件名可留在详情页顶区。绝对路径如需保留，放在「文件」分组末尾，或放到次要位置，不要和光圈、快门放在一起。

## JPEG 与 DNG 中可能读到的内容

GR IIIx 可记录 JPEG、DNG，或 RAW+JPEG。官方规格写明：静止图像为 Exif 2.3 的 JPEG 与 14 位 DNG，色彩空间为 sRGB 或 Adobe RGB。未裁切时 35 mm 换算焦距为 40 mm，裁切为 50 mm 或 71 mm。

标准 Exif 与 TIFF 字段通常包含：相机型号、镜头或焦距、35 mm 换算焦距、光圈、快门、ISO、曝光补偿、曝光程序、测光模式、白平衡、拍摄时间、像素尺寸、色彩空间，以及可选的 GPS。这些字段在 JPEG 和 DNG 中一般都可以不解码图像本身而直接读取。

下列项目多半写在 MakerNote 中，而不是标准 Exif 里：

- 图像设定（Image Control）
- 对焦模式，包括 Snap
- 全按快门 Snap
- 裁切模式
- ND 滤镜
- 部分白平衡细项与色温

2026 年 11 月 15 日核过的实拍 GR IIIx JPEG 与 DNG，把这些值写在紧凑的 Pentax 布局 MakerNote 中，ExifTool 在其 Pentax 表里记载为 `ImageTone`、`FocusMode`、`NeutralDensityFilter` 等。ExifTool 较旧的 Ricoh 表将 `CropMode` 记为「关 / 35 mm / 47 mm」，这对应 GR III 的裁切档位，并非上述 IIIx 文件的布局。GR IIIx 的裁切档位仍是 50 mm 和 71 mm。显示时不得把 GR IIIx 文件标成 35 mm 或 47 mm。当不存在 Ricoh `CropMode` 标签时，应用可依标准 35 mm 换算（40 / 50 / 71）推断。公开样本只确认了未裁切的 40 mm。详见 [gr-iiix-makernote-verification.zh-CN.md](gr-iiix-makernote-verification.zh-CN.md)。

DNG 往往还带有内嵌 JPEG 预览。预览可以用于详情页中的显示，以及在不进行 RAW 解码的情况下估算直方图。预览并不是传感器上的原始采样，若用它画直方图，需要标明这是根据预览生成的。

## 可用的 Rust 库与许可

| 库 | 许可 | 作用 | 对本方案的适用程度 |
| --- | --- | --- | --- |
| [kamadak-exif](https://crates.io/crates/kamadak-exif) 0.6.2 | BSD-2-Clause | 读取 JPEG、TIFF 及 TIFF 结构中的 Exif | 作为第一阶段读取标准字段的首选。许可宽松，与应用打包没有冲突。它把 MakerNote 主要当作原始数据，并不解读 Ricoh 的专用标签。它对 DNG 的 SubIFD 预览也没有现成接口。 |
| [rexif](https://crates.io/crates/rexif) 0.7.6 | MIT | 读取 JPEG 与 TIFF 的 Exif | 可作为备选，能力与第一阶段需求相近，生态小于 kamadak-exif。 |
| [little_exif](https://crates.io/crates/little_exif) | MIT 或 Apache-2.0 | 读写多种格式的 Exif | 许可同样宽松。本功能只需要读取，不必为了写入而引入它。它对 DNG 的支持需要单独验证，不能事先假定与 JPEG 完全相同。 |
| [image](https://crates.io/crates/image) | MIT 或 Apache-2.0 | 解码 JPEG 等栅格图并取像素 | 用于 JPEG 直方图，以及解码从 DNG 中抽出的预览。 |
| [rawler](https://crates.io/crates/rawler) 0.8.0 | LGPL-2.1 | 解码相机 RAW 并读取元数据 | 能做真正的 DNG 像素与 RAW 直方图，但 LGPL-2.1 会给以静态链接为主的应用包带来义务。若以后采用，需要先决定如何满足该许可，不能在未评估的情况下加入。 |
| [gamut-dng](https://crates.io/crates/gamut-dng) | MIT 或 Apache-2.0 | 按 DNG 规范编解码 | 许可宽松，但项目较新、使用面很窄，不作为第一阶段的依赖。 |

第一阶段建议使用 kamadak-exif 读取标准 Exif。Ricoh MakerNote 用一小段专用解析来读，并仅覆盖上面列出的几项。JPEG 直方图用 `image` 解码像素后计算。DNG 的预览与直方图用单独的、只读的 TIFF/DNG 预览提取来完成，不引入 rawler，也不对 CFA 做去马赛克。

不要为了读元数据而去调用或捆绑 ExifTool。应用继续只读取用户的照片，不写回 JPEG 或 DNG。

## 不解码 RAW 时可以完成的部分

可以完成：

- 从 JPEG 和 DNG 读取标准拍摄参数、焦距与 35 mm 换算、色彩空间、时间、文件大小与格式，以及可选的 GPS
- 按已对照公开 GR IIIx JPEG 与 DNG 核对过的 MakerNote 布局，显示图像设定、对焦（文件中有 Snap 时包括 Snap）、裁切和 ND。公开样本未覆盖的字段见 [gr-iiix-makernote-verification.zh-CN.md](gr-iiix-makernote-verification.zh-CN.md)，其文案仍不视为最终结果
- 为可预览的 JPEG 显示详情图和根据原图计算的直方图
- 若 DNG 内嵌预览可用，则显示该预览，并给出根据预览计算的直方图，同时标明数据来源

需要以后另做的部分：

- 把 DNG 原图作为细节可检视的画面（当前相册对 DNG 仍显示「无法预览」）
- 根据 DNG 传感器数据计算的直方图
- 准确反映 RAW 线性数据的波形或 RAW 级别直方图

这些项目属于后续的 RAW 预览工作，而不是拍摄信息面板的范围。相册网格的 DNG 缩略图复用同一套只读内嵌 JPEG 提取，这不是传感器级 RAW 解码。若要用 rawler 做真正的 RAW 解码，须先确认 LGPL-2.1 的处理方式。macOS ImageIO 或其他解码库，可作为后续传感器级预览的备选，并须先完成许可评估。

## 布局

信息放在详情页右侧的可收起侧栏中，不要再用现在这种叠在照片左下角的小卡片作为最终布局。侧栏默认在足够宽的窗口中打开，窗口变窄时收起，以免挤压照片。`I` 和现有的「信息」按钮继续显示或隐藏该侧栏。

侧栏使用半透明面板，与当前毛玻璃窗口一致。字段用短标签加数值，拍摄参数那一组优先排在最上面，字号足以让光圈、快门和 ISO 一眼看到。实现中的顺序随后是镜头与裁切、图像设定、拍摄时间与文件信息，有 GPS 时给出位置，直方图放在最后。没有 GPS 时不留空行。信息不展示绝对路径。

快捷键说明仍由 `?` 打开，不要和拍摄信息挤在同一个侧栏里。

## 实施阶段

1. 详情页已经就绪，拍摄信息放在右侧侧栏。
2. 同一 crate 中已加入 kamadak-exif 与专用 MakerNote 解析。面板展示标准拍摄参数、焦距、色彩空间、时间、可选的 GPS，以及图像设定、对焦（含 Snap）、裁切、ND 和色温。在 GR IIIx 文件上，未裁切显示为 40 mm，裁切显示为 50 mm 或 71 mm，不得套用 ExifTool 中面向 GR III 的 35 mm 和 47 mm 标签。实拍 IIIx 文件使用紧凑的 Pentax 布局 MakerNote；旧的 Ricoh 0x10xx 布局仍可用。公开样本的覆盖范围与未覆盖项见 [gr-iiix-makernote-verification.zh-CN.md](gr-iiix-makernote-verification.zh-CN.md)。
3. JPEG 直方图根据原图像素计算。若 DNG 已提取内嵌预览，则根据该预览计算直方图，并标明来源。
4. RAW 原图预览与根据传感器数据计算的直方图留到后续版本，并单独决定解码库与许可。

## 已确认的事项

2026 年 11 月 15 日（Asia/Shanghai）确认：MakerNote（图像设定、Snap、裁切、ND 等）与标准 Exif 在同一阶段实现，不必先等实拍样本再到下一步。不得把 ExifTool 中面向 GR III 的 CropMode 标签（35 mm / 47 mm）用在 GR IIIx（40 mm / 50 mm / 71 mm）上。

同日稍后，已用公开的机内直出 GR IIIx JPEG 与 DNG 核对布局。实拍 IIIx 文件使用紧凑的 Pentax 布局 MakerNote。旧的 Ricoh 0x10xx 解析仍用于夹具。覆盖范围与仍未验证的字段见 [gr-iiix-makernote-verification.zh-CN.md](gr-iiix-makernote-verification.zh-CN.md)。

实现采用 kamadak-exif，并用专用代码解析 MakerNote。信息面板不展示绝对路径。

## 仍需决定的事项

- 若以后需要真正的 DNG 像素直方图，是接受 rawler 的 LGPL-2.1，还是走 ImageIO 等系统接口。
