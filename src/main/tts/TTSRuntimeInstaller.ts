import fs from 'fs/promises';
import path from 'path';
import CommandLocator from '../runtime/CommandLocator';
import FileDownloadService from '../runtime/FileDownloadService';
import LocalProcessRunner from '../runtime/LocalProcessRunner';
import { ManagedPaths } from '../runtime/ManagedPaths';
import TTSRuntimeArchive from './TTSRuntimeArchive';
import {
  TTSInstallProgress,
  toTTSDownloadProgress,
  writeTTSManifest,
} from './TTSInstallSupport';
import TTSRuntimeService, { TTS_MODEL_NAME } from './TTSRuntimeService';
import { TTSRuntimeStatus } from './TTSRuntimeTypes';

/** 下载官方 Kokoro 模型到 userData；原生模块由 release/app 负责打包。 */
export default class TTSRuntimeInstaller {
  private installPromise: Promise<TTSRuntimeStatus> | null = null;

  private readonly paths: ManagedPaths;

  private readonly runtime: TTSRuntimeService;

  private readonly downloader: FileDownloadService;

  private readonly runner: LocalProcessRunner;

  public constructor(
    paths = ManagedPaths.getInstance(),
    runtime = new TTSRuntimeService(paths),
    downloader = new FileDownloadService(),
    runner = new LocalProcessRunner(),
  ) {
    this.paths = paths;
    this.runtime = runtime;
    this.downloader = downloader;
    this.runner = runner;
  }

  public install(
    onProgress?: (progress: TTSInstallProgress) => void,
    signal?: AbortSignal,
  ): Promise<TTSRuntimeStatus> {
    if (this.installPromise) return this.installPromise;
    this.installPromise = this.installModel(onProgress, signal).finally(() => {
      this.installPromise = null;
    });
    return this.installPromise;
  }

  private async installModel(
    onProgress?: (progress: TTSInstallProgress) => void,
    signal?: AbortSignal,
  ): Promise<TTSRuntimeStatus> {
    const current = this.runtime.getStatus();
    if (current.runtimeReady) return current;
    if (!current.packageInstalled) {
      throw new Error('TTS 原生依赖未安装在 release/app 中');
    }
    onProgress?.({ phase: 'checking', message: '正在检查 TTS 模型目录' });

    const paths = this.paths.ensureRuntimeDirectories('tts');
    const archivePath = path.join(paths.cacheRoot, `${TTS_MODEL_NAME}.tar.bz2`);
    const extractRoot = path.join(paths.cacheRoot, 'tts-model-extract');
    const stagingDir = path.join(
      paths.modelsRoot,
      `${TTS_MODEL_NAME}-installing`,
    );
    const modelDir = this.runtime.getModelDir();

    try {
      await Promise.all([
        fs.rm(extractRoot, { recursive: true, force: true }),
        fs.rm(stagingDir, { recursive: true, force: true }),
      ]);
      await fs.mkdir(extractRoot, { recursive: true });
      onProgress?.({
        phase: 'downloading',
        message: '正在下载 Kokoro TTS 模型',
      });
      await this.downloader.download(current.archiveUrl, archivePath, {
        signal,
        onProgress: (progress) => onProgress?.(toTTSDownloadProgress(progress)),
      });

      const tarPath = CommandLocator.resolve(['tar.exe', 'tar']);
      if (!tarPath) throw new Error('未找到系统 tar 解压工具');
      onProgress?.({ phase: 'extracting', message: '正在解压 TTS 模型' });
      await this.runner.run(tarPath, ['-xf', archivePath, '-C', extractRoot], {
        signal,
      });
      const source = await TTSRuntimeArchive.findModelRoot(extractRoot);
      if (!source) throw new Error('TTS 压缩包缺少 Kokoro 模型文件');

      onProgress?.({ phase: 'installing', message: '正在安装 TTS 模型' });
      await TTSRuntimeArchive.copyModel(source, stagingDir);
      await fs.rm(modelDir, { recursive: true, force: true });
      await fs.rename(stagingDir, modelDir);
      await writeTTSManifest(paths.manifestPath, current.archiveUrl);

      const installed = this.runtime.getStatus();
      if (!installed.runtimeReady) throw new Error('TTS 模型安装后仍不完整');
      onProgress?.({ phase: 'completed', message: 'TTS 模型安装完成' });
      return installed;
    } finally {
      await Promise.all([
        fs.rm(archivePath, { force: true }),
        fs.rm(extractRoot, { recursive: true, force: true }),
        fs.rm(stagingDir, { recursive: true, force: true }),
      ]);
    }
  }
}
