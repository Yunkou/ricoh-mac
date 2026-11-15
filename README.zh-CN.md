# ricoh-mac

一款 Mac 应用：通过 Wi-Fi 从理光 GR IIIx 导入照片，在本地相册里快速选片，并预览 RAW（DNG）。

本仓库收录产品需求、技术设计，以及第一里程碑的实现：本地资料库文件夹、只读探测相机、列出照片，并导入到该文件夹。依赖相机行为的条款依据公开资料编写，需在真机上验证。

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
- RAW / DNG 预览

不含：

- AI 辅助挑片（后续版本候选）
- Developer ID 签名、公证，或对外分发安装包（第一版仅供个人使用，采用 ad hoc 签名）

第一版技术栈为 [Native Shell](https://nsh.dev/) 0.5.x，TSX 与 Rust mixed。第一里程碑锁定 NSH 0.5.1（`nsh 0.5.1 (224d9a7)`）。细节见技术文档。

## 开发、测试与运行

需要 NSH 0.5.1、Rust 工具链，以及 Xcode Command Line Tools。官方安装脚本将 `nsh` 放在 `~/.nsh`，并在 `~/.local/bin/nsh` 建立链接。若 shell 找不到 `nsh`，请将 `~/.local/bin` 加入 `PATH`。

在仓库根目录执行：

```sh
nsh check
nsh test
nsh package --target macos
nsh run --target macos
```

上述步骤也可通过 `make check`、`make test`、`make package`、`make clippy` 执行。`nsh package --target macos` 会在 `.nsh/out/ricoh-mac.app` 写出 ad hoc 签名的应用。

Native Shell 要求 TSX 入口 `App.tsx` 与 `nsh.json` 同处于应用根目录（也是 Rust crate 所在目录，由 `nsh.json` 的 `"rust": "."` 指向）。该入口只负责挂载界面。界面本身在 `ui/` 中：`ui/App.tsx` 组合外壳，`ui/components/` 存放视图，`ui/state/` 存放信号与流程，`ui/lib/` 存放辅助模块。测试是紧挨被测代码的 `*.test.ts` / `*.test.tsx`，例如 `ui/App.test.tsx` 与 `ui/lib/thumb-loader.test.ts`。

开发期覆盖项：

- `RICOH_MAC_NO_WIFI_SWITCH`：只要设置了该环境变量（任意值即可），应用不会切换系统 Wi-Fi。在对着模拟服务开发，或电脑已经加入相机网络时使用。
- 相机 HTTP 源地址：默认是 `http://192.168.0.1`。可在设置中修改（写入应用 `config.json` 的 `camera_base_url`）。使用设置中的恢复默认即可还原。

若要在没有相机时练习客户端，先启动模拟 HTTP 服务，再把应用指向它：

```sh
cargo run --bin mock-camera
```

模拟服务默认监听 `http://127.0.0.1:8080`（可传入绑定地址以更改）。在应用的设置中把相机地址设为该源地址，然后使用「连接相机」，再使用「导入已选」或「全部导入」。该夹具仅用于开发与测试，不是真实相机。

首次启动时选择资料库文件夹。连接真机时，请先打开相机无线局域网。第一次需要保存相机屏幕上显示的网络名称和密码（若电脑已经加入该网络，确认名称后只需输入密码）。密码保存在 macOS 钥匙串中。之后点击「连接相机」会自动切换到该网络，导入完成后默认切回原来的网络。系统可能会请求定位权限以便读取当前 Wi-Fi 名称；可以拒绝并手动输入。首次写入钥匙串时，系统也可能询问是否允许。若自动切网失败，请在系统设置中手动加入相机网络后再试。若电脑在相机网络上仍需要互联网，请使用以太网或 iPhone USB 网络共享。若 Clash Verge 等代理处于 TUN 模式并劫持了 `192.168.0.1`，请把该地址排除出代理。
