# ricoh-mac

一款 Mac 应用：通过 Wi-Fi 从理光 GR IIIx 导入照片，在本地相册里快速选片，并预览 RAW（DNG）。

本仓库收录第一版的产品需求与技术设计。应用源代码尚未纳入。依赖相机行为的条款依据公开资料编写，需在真机上验证。

[英文说明](README.md)

## 文档

- 需求文档：[docs/requirements.zh-CN.md](docs/requirements.zh-CN.md)
- 技术文档：[docs/tech-stack.zh-CN.md](docs/tech-stack.zh-CN.md)
- 仓库：<https://github.com/Yunkou/ricoh-mac>

## 第一版范围

必须有：

- Wi-Fi 连接相机（由用户手动加入相机网络）
- 浏览相机里的照片，并导入到同一个目标文件夹，保留原始文件名
- 本地相册浏览
- 快速选片：1 到 5 星，以及已选、排除两种标记（写入 XMP sidecar，并保存在本地 SQLite 索引中）
- RAW / DNG 预览

不含：

- AI 辅助挑片（后续版本候选）
- 自动切换 Wi-Fi（后续版本候选）
- Developer ID 签名、公证，或对外分发安装包（第一版仅供个人使用，采用 ad hoc 签名）

第一版技术栈为 [Native Shell](https://nsh.dev/) 0.5.x，TSX 与 Rust mixed。细节见技术文档。
