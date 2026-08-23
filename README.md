<p align="center">
  <img src="assets/icon.png" width="128" alt="SpeakSpace Local logo" />
</p>

<h1 align="center">SpeakSpace Local</h1>

<p align="center">
  本地优先的语音笔记与知识工作台
  <br />
  Local-first voice notes and knowledge workspace
</p>

<p align="center">
  <a href="https://github.com/dhebhxh/speakspace-local-electron/actions/workflows/test.yml">
    <img alt="Tests" src="https://github.com/dhebhxh/speakspace-local-electron/actions/workflows/test.yml/badge.svg" />
  </a>
  <a href="https://github.com/dhebhxh/speakspace-local-electron/actions/workflows/codeql-analysis.yml">
    <img alt="CodeQL" src="https://github.com/dhebhxh/speakspace-local-electron/actions/workflows/codeql-analysis.yml/badge.svg" />
  </a>
  <a href="LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/dhebhxh/speakspace-local-electron?style=flat-square" />
  </a>
</p>

<p align="center">
  <img alt="Local-first" src="https://img.shields.io/badge/Local--first-yes-0A8F6A?style=flat-square" />
  <img alt="Electron 35.7.5" src="https://img.shields.io/badge/Electron-35.7.5-47848F?style=flat-square&amp;logo=electron&amp;logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&amp;logo=react&amp;logoColor=0B1F2A" />
  <img alt="TypeScript 5.8" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" />
  <img alt="Webpack 5.98" src="https://img.shields.io/badge/Webpack-5.98-8DD6F9?style=flat-square&amp;logo=webpack&amp;logoColor=1C3C5C" />
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" />
  <img alt="Windows NSIS installer" src="https://img.shields.io/badge/Windows%20installer-NSIS-0078D4?style=flat-square&amp;logo=windows11&amp;logoColor=white" />
</p>

SpeakSpace Local 是一个 Electron 桌面应用，将录音、转写、结构化笔记、场景知识、全文检索和本地 AI 对话整合在同一个工作台中。

本项目基于 [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) 构建，并使用 [Electron](https://www.electronjs.org/)、[React](https://react.dev/)、[React Router](https://reactrouter.com/)、[Webpack](https://webpack.js.org/) 和 [React Fast Refresh](https://www.npmjs.com/package/react-refresh)。开发、调试与桌面端打包流程继续沿用 Electron React Boilerplate 的工程体系。

## 主要能力

- 录音或导入音频，并使用本地 STT 模型完成转写。
- 从转写直接生成结构化笔记，包括摘要、关键要点、任务、提醒和日程。
- 使用内置或自定义 Scenario Knowledge 模板提取场景信息。
- 搜索笔记标题、转写、结构化笔记和场景知识等完整内容。
- 将用户明确关联的笔记作为 Ask AI / Agent 的上下文。
- 导出包含完整笔记内容且经过排版的 Word 和 PDF 文件。
- 通过回收站统一恢复或永久删除笔记、工作空间和自定义模板。

## 本地优先

STT、LLM、TTS 和 Embedding 模型不随安装包分发，用户可在模型管理页面按需下载。模型、数据库和录音等用户数据保存在 Electron 的 `userData` 目录中，不进入项目仓库。

## 安装依赖

建议使用 Node.js 22 和 npm。克隆仓库并安装依赖：

```bash
git clone https://github.com/dhebhxh/speakspace-local-electron.git
cd speakspace-local-electron
npm install
```

Electron React Boilerplate 的通用环境问题可参考其 [安装与调试文档](https://electron-react-boilerplate.js.org/docs/installation)。

## 启动开发环境

在开发模式下启动 Electron 主进程和 React Renderer：

```bash
npm start
```

常用的独立开发命令：

```bash
npm run start:main
npm run start:preload
npm run start:renderer
```

## 代码检查与测试

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
npm test
```

仅检查生产依赖安全问题：

```bash
npm run check:audit
```

## 桌面端打包

为当前平台生成内部未签名构建：

```bash
npm run package
```

生成正式命名构建：

```bash
npm run package:release
```

Windows 构建使用 NSIS 安装器。临时构建文件位于 `release/build/`，人工验收后的安装包可保存到 `release/installers/`；这两个目录都不提交到 Git。模型由用户安装应用后按需下载，因此不会打进安装包。

正式对外分发前需要配置 Windows 或 macOS 代码签名凭据。相关签名检查命令：

```bash
npm run check:signing
```

## 项目结构

```text
src/main/       Electron 主进程、数据库、模型运行时与 IPC
src/renderer/   React 界面与交互
src/shared/     主进程与 Renderer 共享的类型和纯数据
release/app/    打包时使用的生产依赖
assets/         应用图标等静态资源
docs/           项目说明与修改日志
```

详细目录说明见 [docs/project-structure.md](docs/project-structure.md)。参与开发或使用自动化编码工具前，请阅读 [AGENTS.md](AGENTS.md)。

## Electron React Boilerplate 资料

- [官方文档](https://electron-react-boilerplate.js.org/docs/installation)
- [GitHub 仓库](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [Electron 文档](https://www.electronjs.org/docs/latest/)

SpeakSpace Local 保留了 Electron React Boilerplate 的工程基础和许可声明，但产品功能、界面与数据流程由本项目独立维护。

## 许可证

本项目使用 [MIT License](LICENSE)。上游工程版权归 [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) 贡献者所有。
