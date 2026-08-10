# 旧仓库功能迁移清单

## 迁移基线

- 当前目标分支：`merge-old`，从 `W` 的 `c1c883a` 创建。
- 旧代码来源：`SpeakSpace-Local-Group-Repo` 的 `integration/jack-to-main`（`2055ab3`）。
- `integration/jack-to-main` 已包含 `Jack` 和 `fix/note-qa-grounded-ai-jack` 的应用代码；不重复迁移这两个分支。
- 保留当前 React、TypeScript、Electron IPC 分层和规范化 SQLite 数据结构。
- 旧仓库的原生 HTML/CSS/JavaScript 页面和单表 JSON 字段数据库不直接覆盖当前实现。
- 每项功能独立检查、提交和推送；当前阶段不新增测试文件，使用构建、静态检查和人工运行检查验收。

## 相同或相近功能

| 功能 | 当前仓库 | 旧仓库 | 后续处理方式 |
| --- | --- | --- | --- |
| Electron 主进程与 IPC | 已按多个 TypeScript IPC 文件拆分 | 大部分集中在 `src/main/main.js` | 仅迁移处理逻辑，继续保持独立 IPC 文件 |
| Preload API | 已有 `window.electron` 类型化入口 | 使用 `window.desktopSTT` | 扩展当前 API，不引入第二套全局对象 |
| SQLite 笔记存储 | 工作空间、笔记、子笔记、知识输出和会话均为独立表 | 单个 notes 表，大量字段保存 JSON | 保留当前表结构，按需要增加字段或仓储方法 |
| 笔记与子笔记 | 已有实体和 Repository | 已有创建、更新、子笔记和回收站逻辑 | 复用当前实体，补充缺少的业务操作 |
| AI 会话 | 已有会话、消息和笔记上下文表 | 会话保存在笔记 JSON 中 | 使用当前规范化表，迁移问答逻辑而非存储格式 |
| STT 模型管理 | 已改为流式下载、SHA-1 校验和 userData 激活状态 | 有 Whisper/Parakeet 运行时、进度和状态检测 | 保留当前 UI，继续补齐运行时和真实转写能力 |
| LLM 模型管理 | 已使用 Ollama 实际列表和 userData 激活状态，并支持官方便携运行时 | 有便携 Ollama、服务启动、状态和进度管理 | 已按当前 IPC 和 Model Manager 结构迁移，不保留旧状态源 |
| 硬件检测与推荐 | 已有系统画像和模型评分 | 主进程内有更细的 GPU/内存检测 | 提取可复用检测项，继续使用当前推荐结果格式 |
| 工作流模板 | 已有模板增删改查 | 有结构化模板和 LLM 处理器 | 保留当前模板表，接入真实生成流程 |
| 工作空间页面 | 已有完整 React 页面、筛选、预览和建议 | 旧版以文件夹、标签组织笔记 | 不替换页面；将旧笔记能力映射到当前 Workspace |
| 设置页面 | 已有字号、浅色/深色/跟随系统 | 有 STT/LLM/TTS 运行时设置 | 保留当前页面结构，后续增加 AI 运行时设置分区 |

## 当前缺失、需要迁移的功能

| 顺序 | 功能项 | 旧仓库主要来源 | 当前状态 | 迁移状态 |
| --- | --- | --- | --- | --- |
| 1 | 受管资源路径 | `managed-paths.js` | 已统一到 Electron `userData`，并保留现有模型位置 | 已迁移 |
| 2 | 运行时状态汇总 | 各 runtime service | 已提供 STT/LLM/TTS 受管状态只读 IPC | 已迁移 |
| 3 | 录音文件保存和保留策略 | `transcription-service.js`、`audio-retention.js` | 已接入 React 录音状态、保存、放弃和麦克风释放 | 已迁移 |
| 4 | 文件选择与音频时长探测 | `audio-duration.js`、`audio:pick` | 已提供安全文件选择和时长 IPC | 已迁移 |
| 5 | Whisper/Parakeet 真实转写 | `transcription-service.js` | Whisper 执行与 Windows 官方运行时安装已迁移，Parakeet 待接入 | 进行中 |
| 6 | 转写任务进度、取消和重试 | `transcription-job-manager.js` | React 页面已接入文件/录音任务、进度、取消和重试 | 已迁移 |
| 7 | Ollama 服务与运行时状态 | `llm-service.js` | 已检测系统/受管可执行文件、服务、模型和激活状态，按需启动服务，并可校验安装官方 Windows 便携包 | 已迁移 |
| 8 | 结构化笔记生成 | `structured-processor.js` | 已按当前模板表生成 Markdown、保存知识输出，并接入 Workspace 笔记详情 | 已迁移 |
| 9 | 基于笔记内容的问答 | `structured-processor.js`、当前仓库 `feature/askai` | 已接入工作区隔离的本地问答、会话记录、安全 IPC 和拆分后的 React 页面 | 已迁移 |
| 10 | 本地 TTS 和说话人选择 | `tts-service.js`、`tts-worker.js` | 原生依赖位于 `release/app`；已接入受管模型安装、异步合成、53 个音色、试听，以及 Ask AI/知识输出朗读 | 已迁移 |
| 11 | Embedding 与相似笔记检索 | `embedding-service.js` | 已接入 `bge-m3` 安装、Ollama 批量向量、独立 SQLite 增量索引、工作区隔离搜索，以及模型管理和工作空间结果入口 | 已迁移 |
| 12 | Agent 工具编排和步骤事件 | `agent-orchestrator.js` | 未实现 | 待迁移 |
| 13 | 回收站、恢复和永久删除 | `db-service.js` | 当前 Workspace 直接级联删除 | 待评估后迁移 |
| 14 | 文件夹、标签及动作项完成状态 | `db-service.js` | 当前笔记表尚无对应字段 | 待评估后迁移 |

## 当前仓库未进入 main 的分支审计

以下结果以 2026-08-10 刷新后的 `origin/main` 为基线。`ahead` 只表示提交拓扑，不能代替功能验收；所有需要保留的功能仍要在 `merge-old` 中逐项适配和检查。

| 分支 | 相对 main | 与 merge-old 的关系 | 处理结论 |
| --- | --- | --- | --- |
| `origin/W` | ahead 6 | 90 个变更文件已全部包含在 `merge-old` | 不再重复合并 |
| `origin/feature/askai` | ahead 6 | 28 个变更文件中有 22 个与 `merge-old` 重叠 | Ask AI 后端、IPC、页面和布局修正已按当前结构迁移；原分支不再整段合并 |
| `origin/feature/dashboard` | ahead 2 | 17 个变更文件中有 13 个 Dashboard 独有文件，4 个入口或依赖文件重叠 | 保留 Dashboard 页面；单独审查依赖、数据来源和路由后接入 |
| `origin/feature/recording` | ahead 1 | 仅新增 5 个未接线的 `Recording1` 原型文件 | 已被当前受管录音、文件保存和转写任务页面覆盖，不合并原型 |
| `origin/feature/workflow-engine` | ahead 1 | 21 个变更文件中有 13 个与 `merge-old` 重叠，另含旧录音原型和早期转写服务 | 先逐文件核对 Repository 差异；录音和转写部分已被当前实现覆盖，不整分支合并 |
| `origin/feature/workflow-update` | ahead 0、behind 1 | 已由 `origin/main` 包含 | 无需处理 |

### 分支验收门槛

- 先识别独有业务功能，再判断是否已被 `merge-old` 的新实现覆盖。
- 对仍需保留的功能，迁移最小文件集合，并按当前类型、Repository、IPC 和 React 页面结构适配。
- 每项至少通过目标文件 ESLint、主进程或渲染进程构建以及相关行为检查后，才独立 commit 和 push。
- `merge-old` 验收完成前不直接改写 `main`，避免把未完成或相互覆盖的实现一次性带入主线。

## 不直接迁移的内容

- 旧版 `index.html`、`renderer.js` 和 `styles.css`：功能将以当前 React 组件重新接入。
- 旧版大型 `main.js`：拆成当前 `src/main` 下的服务和 IPC 文件。
- 旧版 preload 全局对象 `desktopSTT`：统一扩展当前 `window.electron`。
- 旧版 notes 单表及 JSON 字段：避免破坏当前 Workspace 外键和 Repository。
- 下载后的模型、运行时、录音、SQLite 数据库和 `.speakspace-data`：这些是本机数据，不进入 Git。

## 其他旧分支

- `feature/dod`：仅 README 需求说明，作为验收参考。
- `project-proposal`：项目提案和会议材料，不属于运行代码迁移。
- `project-status`：只有状态看板 README，作为历史记录。
- `LF-c-patch-1`：没有领先旧 main 的独有提交。
- `gigi/ask-ai`：与旧 main 指向同一提交。
