# Changelog

本文件记录 SpeakSpace Local Mobile 面向组内测试的稳定版本。iOS 安装包不发布到 App Store，二进制资产附在团队仓库对应的 GitHub Release 中。

## [1.2.0] - 2026-08-24

### Added

- Ask AI 等待本地模型回复时显示处理中状态，并将会话和消息持久化到本地 SQLite。
- 新增统一的 `SafeAreaModal`，让新建、重命名、编辑、移动等编辑弹窗默认位于安全区域内的屏幕中央。
- Structured Note 生成增加停止原因识别、JSON 完整性检查、分段重试和确定性降级路径。

### Changed

- Ask AI 直接使用当前锁定笔记的 transcript 作为回答依据，增强中英文问题的证据抽取和短问题匹配。
- 本地 LLM 的上下文与输出预算按 Ask AI 和 Structured Note 场景分别配置；Structured Note 的 token 上限从旧值提高，并同时限制批次长度，避免只提高上限造成等待时间和内存占用失控。
- 日期与时间解析支持更多英文表达和 24 小时制写法。

### Fixed

- 修复笔记中存在答案时 Ask AI 仍返回“信息不足”的误判。
- 修复较长 Structured Note 输出在 JSON 中途被截断后显示“unreadable result”的问题。
- 修复 Move note 及其他编辑弹窗可能顶到 iPhone 状态栏的问题。
- 修复跨页面返回后 Ask AI 对话消失的问题。

发布记录：[SpeakSpace iOS v1.2.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.2.0)

## [1.1.0] - 2026-08-23

- 新增 Light、Dark、System 主题偏好。
- Home 展示完整 Task 列表并支持完成和恢复。
- AI、Structured Note 和 Knowledge 内容支持本地 TTS 朗读、暂停和续播。

发布记录：[SpeakSpace iOS v1.1.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.1.0)

## [1.0.0] - 2026-08-21

- 首个组内 iPhone 稳定版，包含本地录音转写、音频导入、笔记、Workspace、模型管理和 Ask AI 基础能力。

发布记录：[SpeakSpace iOS v1.0.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.0.0)
