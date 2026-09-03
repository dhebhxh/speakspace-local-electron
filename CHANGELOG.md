# Changelog

本文件记录 LetsVoice Mobile 面向组内测试的稳定版本。iOS 安装包不发布到 App Store，二进制资产附在团队仓库对应的 GitHub Release 中。

## [1.3.0] - 2026-08-24

### Added

- Settings 新增统一 Trash，覆盖 Note、Workspace、Ask AI conversation 和自定义 Knowledge template，并支持恢复与永久删除。
- Home、Workspace 和 Search 新增长按多选，可批量移动、移入 Trash、置顶和取消置顶。
- Ask AI 支持同时选择最多三篇 Note，自定义 Knowledge template 支持结构草稿、编辑和不可变生成历史。
- Note 保存后自动分类并允许手动修改；搜索使用本地关键词与有限错拼匹配，不需要下载 Embedding 模型。
- Task 支持置顶，以及 daily、weekdays、weekly、biweekly 和 monthly 五种滚动周期。

### Changed

- 多 Note Ask AI 按 Note 均衡分配上下文，内容较长时优先给出有边界的 best-effort answer；聊天界面不显示来源列表。
- 删除流程由立即删除改为 soft delete；永久删除在事务内处理关联数据，再清理音频文件。
- Expo SDK 57 依赖对齐到官方推荐 patch，并重新同步 CocoaPods 和真机 Release 构建。

### Fixed

- 修复批量操作部分成功时可能留下不一致状态的问题，整批操作现在在同一 SQLite 事务内提交或回滚。
- 修复单 Note 与多 Note 会话可能错误恢复到不同来源集合的问题。
- 修复周期 Task 完成后重复生成、遗漏工作日跳转或恢复到错误 occurrence 的边界情况。

发布记录：[LetsVoice iOS v1.3.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.3.0)

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

发布记录：[LetsVoice iOS v1.2.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.2.0)

## [1.1.0] - 2026-08-23

- 新增 Light、Dark、System 主题偏好。
- Home 展示完整 Task 列表并支持完成和恢复。
- AI、Structured Note 和 Knowledge 内容支持本地 TTS 朗读、暂停和续播。

发布记录：[LetsVoice iOS v1.1.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.1.0)

## [1.0.0] - 2026-08-21

- 首个组内 iPhone 稳定版，包含本地录音转写、音频导入、笔记、Workspace、模型管理和 Ask AI 基础能力。

发布记录：[LetsVoice iOS v1.0.0](https://github.com/dhebhxh/speakspace-local-mobile/releases/tag/ios-v1.0.0)
