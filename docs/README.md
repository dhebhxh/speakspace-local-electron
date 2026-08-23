# SpeakSpace Local 文档索引

项目总览：[English](../README.md) · [简体中文](../README.zh-CN.md)

根目录只保留项目级入口；设计决策、测试证据和历史过程统一放在这里。

## 当前工程文档

| 文档 | 用途 |
| --- | --- |
| [项目结构](./project-structure.md) | 目录职责、进程边界、路径别名和代码放置规则 |
| [任务提取用例](./testing/task-extraction-cases.md) | 日期、所有权和任务抽取的验收语料 |
| [TTS 模型基准](./testing/tts-model-benchmark-2026-08-13.md) | Kokoro、MeloTTS、MOSS 的性能、内存与可懂度数据 |
| [TTS 平台构建](./testing/tts-platform-builds.md) | 原生 TTS 依赖的跨平台构建边界 |
| [Windows TTS 手工验收](./testing/tts-windows-manual.md) | Windows 安装包上的 TTS 验收步骤 |

## 历史与追踪

- [`changelog/`](./changelog/) 保存逐次开发日志。
- [`archive/`](./archive/) 保存已经完成阶段的迁移或审计材料，不代表当前实现。
- 当前架构和开发规则以根目录 [`README.md`](../README.md) 与
  [`AGENTS.md`](../AGENTS.md) 为准。

## 文件归类规则

- 产品介绍、快速开始和总体架构写入根 `README.md`。
- 可复现的测试报告和验收步骤放入 `testing/`。
- 每次开发过程记录放入 `changelog/`，不要在根目录新增临时日志。
- 已失效但仍有历史价值的方案放入 `archive/`；无引用、无证据价值的草稿直接删除。
- 图片只有在当前文档实际引用时才进入仓库，并与使用它的文档放在同一主题目录。
