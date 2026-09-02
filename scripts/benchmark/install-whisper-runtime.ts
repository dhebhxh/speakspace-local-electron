/**
 * 一次性安装 whisper.cpp 运行时并下载一个模型，供 STT 跨机测速使用。
 *
 * 官方应用只能通过模型管理页手动下载 whisper 运行时/模型，这里直接复用同一套
 * 主进程逻辑（WhisperRuntimeInstaller / STTModelManager）在命令行下跑一遍。
 * 它们内部通过 ManagedPaths 依赖 Electron 的 app.getPath('userData')，而这
 * 只是个一次性下载脚本，不需要真的起 Electron 主进程/窗口，所以用
 * register-electron-app-stub.js 伪造了这一个方法，脚本本身仍在
 * ELECTRON_RUN_AS_NODE=1 的纯 Node 环境下跑。
 */

/* eslint-disable no-console */

import WhisperRuntimeInstaller from '../../src/main/transcription/WhisperRuntimeInstaller';
import { STTModelManager } from '../../src/main/AI-module/STTModelManager';
import FfmpegInstaller from '../../src/main/runtime/FfmpegInstaller';

const MODEL_ID = process.argv[2] || 'whisper-small';

async function main(): Promise<void> {
  const ffmpegInstaller = new FfmpegInstaller();
  console.log('正在安装 ffmpeg...');
  await ffmpegInstaller.install((progress) => {
    console.log(`[ffmpeg] ${progress.phase} ${progress.message}`);
  });
  console.log('ffmpeg 安装完成。');

  const installer = new WhisperRuntimeInstaller();
  console.log('正在安装 whisper.cpp 运行时...');
  await installer.install((progress) => {
    console.log(`[runtime] ${progress.phase} ${progress.message}`);
  });
  console.log('whisper.cpp 运行时安装完成。');

  const modelManager = new STTModelManager();
  const models = modelManager.getModelList();
  const target = models.find((m) => m.id === MODEL_ID);
  if (!target) {
    throw new Error(`未知模型 id: ${MODEL_ID}`);
  }
  if (target.downloaded) {
    console.log(`模型 ${MODEL_ID} 已下载，跳过。`);
  } else {
    console.log(`正在下载模型 ${MODEL_ID}...`);
    let lastPct = -1;
    await modelManager.downloadModel(MODEL_ID, (progress) => {
      const pct = progress.totalBytes
        ? Math.floor((progress.receivedBytes / progress.totalBytes) * 100)
        : -1;
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct;
        console.log(`[model] ${pct}%`);
      }
    });
    console.log(`模型 ${MODEL_ID} 下载完成。`);
  }
}

main().catch((error) => {
  console.error('安装失败：', error);
  process.exitCode = 1;
});
