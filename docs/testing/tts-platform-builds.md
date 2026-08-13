# TTS 平台构建说明

TTS 原生依赖在 `npm install` 时按当前操作系统和 CPU 架构安装。因此发布包应在对应的构建机上生成，不要在 arm64 Mac 上直接交叉生成 x64 发布包，反之亦然。

| 目标              | 构建机                        | 命令                             |
| ----------------- | ----------------------------- | -------------------------------- |
| macOS arm64       | Apple Silicon Mac             | `npm install && npm run package` |
| macOS x64         | Intel Mac 或 x64 macOS runner | `npm install && npm run package` |
| Windows 10/11 x64 | Windows x64                   | `npm install && npm run package` |

每个平台从干净依赖目录开始构建，可确保 `sherpa-onnx-node`、`onnxruntime-node` 和 `better-sqlite3` 都包含目标架构的原生文件。

打包后还需在目标系统执行对应的手工 TTS 验收；Windows 步骤见 [tts-windows-manual.md](./tts-windows-manual.md)。
