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

/* eslint-disable no-console, no-await-in-loop, no-continue, no-restricted-syntax */

import WhisperRuntimeInstaller from '../../src/main/transcription/WhisperRuntimeInstaller';
import { STTModelManager } from '../../src/main/AI-module/STTModelManager';
import FfmpegInstaller from '../../src/main/runtime/FfmpegInstaller';
import {
  STT_BENCHMARK_MODELS,
  sttBenchmarkCatalogIds,
} from './stt-benchmark-models';
import { totalSize } from './model-size';

/**
 * 不传参数时装整套跨机器基准模型（见 stt-benchmark-models.ts）。
 * 以前这里默认只装 whisper-small 一个，于是每台机器测到的模型集合都不一样，
 * cross-stt-rtf.svg 缺了一大片柱子。
 */
const MODEL_IDS =
  process.argv.slice(2).filter((argument) => !argument.startsWith('-')).length >
  0
    ? process.argv.slice(2).filter((argument) => !argument.startsWith('-'))
    : sttBenchmarkCatalogIds();

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
  const failures: string[] = [];

  const pending = MODEL_IDS.filter(
    (id) => !models.find((m) => m.id === id)?.downloaded,
  );
  const pendingSize = totalSize(
    STT_BENCHMARK_MODELS.filter((model) => pending.includes(model.catalogId)),
  );
  console.log(
    `需要就绪的模型 ${MODEL_IDS.length} 个，其中 ${pending.length} 个待下载` +
      `${pending.length > 0 ? `（约 ${pendingSize}）` : ''}。`,
  );
  for (const modelId of MODEL_IDS) {
    const target = models.find((m) => m.id === modelId);
    if (!target) {
      failures.push(`${modelId}: 未知模型 id`);
      console.error(`[失败] 未知模型 id: ${modelId}`);
      continue;
    }
    if (target.downloaded) {
      console.log(`模型 ${modelId} 已下载，跳过。`);
      continue;
    }
    console.log(`正在下载模型 ${modelId}...`);
    let lastPct = -1;
    try {
      // 逐个串行下载：跟基准本身一样，避免并发抢带宽让进度输出没法看。
      await modelManager.downloadModel(modelId, (progress) => {
        const pct = progress.totalBytes
          ? Math.floor((progress.receivedBytes / progress.totalBytes) * 100)
          : -1;
        if (pct !== lastPct && pct % 10 === 0) {
          lastPct = pct;
          console.log(`[model] ${modelId} ${pct}%`);
        }
      });
      console.log(`模型 ${modelId} 下载完成。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${modelId}: ${message}`);
      console.error(`[失败] ${modelId}: ${message}`);
    }
  }

  if (failures.length > 0) {
    // 部分失败不抛异常：已经装好的那些照样能测，缺的那几档在跨机器表里留空即可。
    console.error(
      `\n有 ${failures.length} 个模型未就绪：\n${failures.join('\n')}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('安装失败：', error);
  process.exitCode = 1;
});
