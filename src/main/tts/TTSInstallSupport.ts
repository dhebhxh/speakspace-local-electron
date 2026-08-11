import fs from 'fs/promises';
import { DownloadProgress } from '../runtime/FileDownloadService';
import { TTS_MODEL_NAME } from './TTSRuntimeService';

export type TTSInstallProgress = {
  phase: 'checking' | 'downloading' | 'extracting' | 'installing' | 'completed';
  message: string;
  receivedBytes?: number;
  totalBytes?: number | null;
};

export function toTTSDownloadProgress(
  progress: DownloadProgress,
): TTSInstallProgress {
  return {
    phase: 'downloading',
    message: '正在下载 Kokoro TTS 模型',
    receivedBytes: progress.receivedBytes,
    totalBytes: progress.totalBytes,
  };
}

/** 安装清单只记录可重建信息，不存用户文字或音频。 */
export async function writeTTSManifest(
  manifestPath: string,
  source: string,
): Promise<void> {
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        source,
        model: TTS_MODEL_NAME,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
