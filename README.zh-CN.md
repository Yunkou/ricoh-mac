# ricoh-mac

一款 Mac 应用：通过 Wi-Fi 从理光 GR IIIx 导入照片，在本地相册里快速选片，并预览 RAW（DNG）。

本仓库收录产品需求、技术设计，以及保存位置、只读探测相机、导入到该文件夹，以及本地相册浏览的实现。依赖相机行为的条款依据公开资料编写，需在真机上验证。

[英文说明](README.md)

## 文档

- 需求文档：[docs/requirements.zh-CN.md](docs/requirements.zh-CN.md)
- 技术文档：[docs/tech-stack.zh-CN.md](docs/tech-stack.zh-CN.md)
- 产品说明：[PRODUCT.zh-CN.md](PRODUCT.zh-CN.md)
- 设计说明：[DESIGN.zh-CN.md](DESIGN.zh-CN.md)
- 仓库：<https://github.com/Yunkou/ricoh-mac>

## 第一版范围

必须有：

- Wi-Fi 连接相机（使用已保存的相机配置自动切网，失败时再手动加入）
- 浏览相机里的照片，并导入到同一个目标文件夹，保留原始文件名
- 本地相册浏览
- 快速选片：1 到 5 星，以及已选、排除两种标记（写入 XMP sidecar，并保存在本地 SQLite 索引中）
- 将当前相册中的全部已选原片和已有 XMP sidecar 复制到用户指定的文件夹；不覆盖同名文件，也不改写源文件
- RAW / DNG 预览

不含：

- AI 辅助挑片（后续版本候选）
- Developer ID 签名、公证，或对外分发安装包（第一版仅供个人使用，采用 ad hoc 签名）

第一版技术栈为 [Native Shell](https://nsh.dev/) 0.5.x，TSX 与 Rust mixed。第一里程碑锁定 NSH 0.5.1（`nsh 0.5.1 (224d9a7)`）。细节见技术文档。

## 界面

启动后显示两个功能入口：

- **照片：** 浏览已导入到单一保存位置中的照片，无需连接相机。界面为缩略图网格和独立的照片详情页。点击照片或按空格、回车进入详情。详情页提供上一张与下一张、适应窗口或实际尺寸，以及右侧拍摄信息面板。返回或 Esc 回到相册网格。底部有简洁提示，也可打开 “?” 快捷键列表。JPEG 可在网格和详情页中显示。若 DNG 含有内嵌 JPEG 预览，相册网格和详情页都可以显示该预览。详情页会标明这是预览，而不是原片像素。没有可用预览的文件，在网格中使用占位说明。应用只读取该文件夹，不修改原片。相册网格不对传感器级 RAW 数据解码。在「照片」中可以把当前相册里的全部已选照片复制到另一个文件夹，连同已有的 XMP sidecar；现有同名文件不会被覆盖。导出不受当前筛选影响，结束后可以打开目标文件夹。
- **设备：** 列出已保存的相机配置，使用自动切网连接相机（密码保存在 macOS 钥匙串中），然后浏览、选择并导入照片。导入结束后，「查看照片」会打开「照片」。

窗口没有产品名大标题，也没有常驻侧栏。可用紧凑的分段控件在两个区域之间切换，并用返回控件回到启动页。圆形图标是角落里的设置入口。

## 开发、测试与运行

需要 NSH 0.5.1、Rust 工具链，以及 Xcode Command Line Tools。官方安装脚本将 `nsh` 放在 `~/.nsh`，并在 `~/.local/bin/nsh` 建立链接。若 shell 找不到 `nsh`，请将 `~/.local/bin` 加入 `PATH`。

在仓库根目录执行：

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

上述步骤也可通过 `make check`、`make test`、`make package`、`make clippy` 执行。`nsh package --target macos` 会在 `.nsh/out/ricoh-mac.app` 写出 ad hoc 签名的应用。`make dist` 会重新打包该应用，并在 `dist/` 下写出带版本号的 zip 与 SHA-256 校验文件。

Native Shell 要求 TSX 入口 `App.tsx` 与 `nsh.json` 同处于应用根目录（也是 Rust crate 所在目录，由 `nsh.json` 的 `"rust": "."` 指向）。该入口只负责挂载界面。界面本身在 `ui/` 中：`ui/App.tsx` 组合外壳，`ui/components/` 存放视图，`ui/state/` 存放信号与流程，`ui/lib/` 存放辅助模块。测试是紧挨被测代码的 `*.test.ts` / `*.test.tsx`，例如 `ui/App.test.tsx` 与 `ui/lib/thumb-loader.test.ts`。

开发期覆盖项：

- `RICOH_MAC_NO_WIFI_SWITCH`：只要设置了该环境变量（任意值即可），应用不会切换系统 Wi-Fi。在对着模拟服务开发，或电脑已经加入相机网络时使用。
- 相机 HTTP 源地址：默认是 `http://192.168.0.1`。可在设置中修改（写入应用 `config.json` 的 `camera_base_url`）。使用设置中的恢复默认即可还原。

若要在没有相机时练习客户端，先启动模拟 HTTP 服务，再把应用指向它：

```sh
cargo run --bin mock-camera
```

模拟服务默认监听 `http://127.0.0.1:8080`（可传入绑定地址以更改）。在应用的设置中把相机地址设为该源地址，然后使用「连接相机」，再使用「导入已选」或「全部导入」。该夹具仅用于开发与测试，不是真实相机。

启动后会看到「设备」和「照片」。请在提示时或在设置中选择保存位置。连接真机时，进入「设备」，并先打开相机无线网络。第一次需要保存相机屏幕上显示的网络名称和密码（若电脑已经加入该网络，确认名称后只需输入密码）。密码保存在 macOS 钥匙串中。之后点击「连接相机」会自动切换到该网络，导入完成后默认切回原来的网络。系统可能会请求定位权限以便读取当前 Wi-Fi 名称；可以拒绝并手动输入。首次写入钥匙串时，系统也可能询问是否允许。若自动切网失败，请在系统设置中手动加入相机网络后再试。若电脑在相机网络上仍需要互联网，请使用网线或 iPhone 网络共享。若网络被代理占用，请把相机网络排除出代理后再试。

## 第三方字体

界面使用 [ChillDINGothic](https://github.com/Warren2060/ChillDIN-ChillDINGothic)（寒蝉德黑体）v1.300 的 Regular 与 SemiBold。官方 OpenType 文件随应用打包，并仅在本进程内注册，不会安装到 macOS。

该字体软件采用 SIL Open Font License 1.1 许可。版权 © 2023 ChillType，保留字体名称 'ChillDIN' 与 'ChillDINGothic'；版权 © 2014-2021 Adobe，保留字体名称 'Source'。官方许可文本随应用分发，源码位于 `ui/assets/fonts/LICENSE`。文件从 [ChillDINGothic_v1.300 发行包](https://github.com/Warren2060/ChillDIN-ChillDINGothic/releases/tag/ChillDINGothic_v1.300) 原样拷贝，来源与 SHA-256 记在 `ui/assets/fonts/SOURCE.txt`。

## 发布

第一版的 GitHub Release 提供 ad hoc 签名的 macOS 应用，未经公证，也不使用 Developer ID 签名。

应用版本号必须在 `nsh.json` 的 `version` 与 `Cargo.toml` 的 `package.version` 中保持一致。发布标签为该版本号加上 `v` 前缀：版本 `0.1.0` 对应标签 `v0.1.0`。预发布版本使用同一规则，因此版本 `0.1.0-rc.1` 对应标签 `v0.1.0-rc.1`。若标签与这两个文件中的版本号不完全一致，发布工作流会失败。

发布步骤：

1. 在 `nsh.json` 与 `Cargo.toml` 中写入相同的版本号，如有预发布后缀（例如 `-rc.1` 或 `-beta.1`）也须一并写入。
2. 将该更改提交到 `main`。
3. 创建附注标签并推送：

```sh
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

推送匹配 `v*` 的标签后，Release 工作流会启动。打包会立即在 arm64 运行器上开始。发布 GitHub Release 需等到打包成功，并且同一提交已通过质量门禁：已有成功的 CI 运行；若该提交尚未运行过 CI，则补跑与 CI 相同的 `nsh check`、`nsh test` 以及 `cargo fmt` / `clippy`（`RICOH_MAC_NO_WIFI_SWITCH=1`）。若该提交的 CI 已经通过，工作流不会再重复这些检查。归档文件名为 `ricoh-mac-<tag>-macos-arm64.zip`，同时附带 SHA-256 文件。版本号带有 `-rc`、`-beta` 等后缀的标签会发布为 pre-release。对同一标签重新运行该工作流会更新已有 Release，并替换已上传的文件。若要用更新后的工作流文件为已经推送的标签重新打包，请从 `main` 运行 Release 工作流，并将输入 `tag` 设为该标签，例如 `gh workflow run release.yml --ref main -f tag=v0.1.0`。该工作流会检出该标签、打包该提交，并将归档上传到已有 Release。


若只需在 arm64 Mac 上重新生成归档和校验文件、而不发布：

```sh
make dist
```

默认会根据上述文件中的版本号写出 `dist/ricoh-mac-v<version>-macos-arm64.zip` 与 `dist/ricoh-mac-v<version>-macos-arm64.zip.sha256`。传入 `TAG=v0.1.0` 可要求标签名与版本文件一致。

解压下载的构建后，macOS 可能在首次打开时拦截。请按住 Control 点按（或右键点按）`ricoh-mac.app` 并选择「打开」，或移除隔离属性：

```sh
xattr -dr com.apple.quarantine ricoh-mac.app
```
