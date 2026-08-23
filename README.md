<p align="center">
  <img src="assets/icon.png" width="128" alt="SpeakSpace Local logo" />
</p>

# SpeakSpace Local

本地优先的语音笔记与知识工作台。应用把录音、转写、结构化笔记、场景知识、笔记检索和本地 AI 对话整合在同一个 Electron 桌面端中。

## 主要能力

- 录音或导入音频，并使用本地 STT 模型转写。
- 从转写直接生成结构化笔记，包括摘要、关键要点、任务和提醒。
- 通过内置或自定义 Scenario Knowledge 模板提取场景信息。
- 在工作空间中搜索笔记的标题、转写、结构化笔记和场景知识。
- 将关联笔记作为 Ask AI / Agent 的明确上下文。
- 导出包含完整笔记内容的 Word 和 PDF。
- 通过回收站统一恢复或永久删除用户内容。

模型不随安装包分发。用户在模型管理页面按需下载，模型和数据库均保存在 Electron `userData` 目录，不进入项目仓库。

## 本地开发

建议使用 Node.js 22 和 npm。

```bash
npm install
npm start
```

常用校验命令：

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
npm test
```

## 打包

内部未签名构建：

```bash
npm run package
```

正式命名构建：

```bash
npm run package:release
```

Windows 产物为 NSIS 安装器。临时构建文件位于 `release/build/`，人工验收后的安装包可保存到 `release/installers/`；两者都不提交到 Git。正式对外分发前应配置 Windows 或 macOS 代码签名凭据。

## 项目结构

详细目录说明见 [docs/project-structure.md](docs/project-structure.md)。开发或自动化修改前请阅读 [AGENTS.md](AGENTS.md)，其中记录了架构边界、删除策略、国际化和验收要求。

## 许可证

本项目使用 [MIT License](LICENSE)，并保留上游 Electron React Boilerplate 的许可声明。
