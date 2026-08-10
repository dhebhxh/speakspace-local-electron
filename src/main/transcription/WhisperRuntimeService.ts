import fs from 'fs';
import path from 'path';
import { STTModelManager } from '../AI-module/STTModelManager';
import CommandLocator from '../runtime/CommandLocator';
import { ManagedPaths } from '../runtime/ManagedPaths';

export type WhisperRuntimeLocation = 'portable' | 'system-path' | 'missing';

export type WhisperRuntimeStatus = {
  ready: boolean;
  runtimeLocation: WhisperRuntimeLocation;
  whisperCliPath: string;
  whisperCliPresent: boolean;
  ffmpegPath: string | null;
  ffmpegPresent: boolean;
  activeModelId: string | null;
  activeModelName: string | null;
  activeModelPath: string | null;
};

/** 查找本机 Whisper CLI、音频转换工具和当前已激活模型。 */
export default class WhisperRuntimeService {
  private readonly managedPaths: ManagedPaths;

  private readonly modelManager: STTModelManager;

  public constructor(
    managedPaths = ManagedPaths.getInstance(),
    modelManager = new STTModelManager({ managedPaths }),
  ) {
    this.managedPaths = managedPaths;
    this.modelManager = modelManager;
  }

  public getStatus(): WhisperRuntimeStatus {
    const portableBinDir = this.getPortableBinDir();
    const portableCandidates =
      process.platform === 'win32'
        ? ['whisper-cli.exe', 'main.exe']
        : ['whisper-cli', 'main'];
    const portablePath = portableCandidates
      .map((candidate) => path.join(portableBinDir, candidate))
      .find((candidate) => fs.existsSync(candidate));
    const systemPath = portablePath
      ? null
      : CommandLocator.resolve(['whisper-cli', 'whisper-cli.exe']);
    const whisperCliPath =
      portablePath ??
      systemPath ??
      path.join(portableBinDir, portableCandidates[0]);
    let runtimeLocation: WhisperRuntimeLocation = 'missing';
    if (portablePath) runtimeLocation = 'portable';
    else if (systemPath) runtimeLocation = 'system-path';
    const activeModel = this.modelManager.getActivatedModel();
    const activeModelPath = this.modelManager.getActivatedModelPath();
    const ffmpegPath = CommandLocator.resolve([
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    ]);

    return {
      ready: runtimeLocation !== 'missing' && activeModelPath !== null,
      runtimeLocation,
      whisperCliPath,
      whisperCliPresent: runtimeLocation !== 'missing',
      ffmpegPath,
      ffmpegPresent: ffmpegPath !== null,
      activeModelId: activeModel?.id ?? null,
      activeModelName: activeModel?.name ?? null,
      activeModelPath,
    };
  }

  public requireReady(): WhisperRuntimeStatus {
    const status = this.getStatus();
    if (!status.whisperCliPresent) {
      throw new Error(
        '未找到 whisper-cli，请先安装本地运行时 / whisper-cli is not installed',
      );
    }
    if (!status.activeModelPath) {
      throw new Error(
        '请先下载并激活一个 STT 模型 / Download and activate an STT model first',
      );
    }

    return status;
  }

  public getPortableBinDir(): string {
    const { runtimeRoot } = this.managedPaths.getRuntimePaths('stt');
    return path.join(runtimeRoot, 'whisper', 'bin');
  }
}
