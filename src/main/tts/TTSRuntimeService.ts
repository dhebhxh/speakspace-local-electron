import fs from 'fs';
import path from 'path';
import { ManagedPaths } from '../runtime/ManagedPaths';
import { requireAtRuntime } from '../runtime/RuntimeRequire';
import { TTSRuntimeStatus } from './TTSRuntimeTypes';
import { DEFAULT_SPEAKER_ID, getTTSSpeakers } from './TTSVoices';

export const TTS_MODEL_NAME = 'kokoro-multi-lang-v1_0';
export const TTS_ARCHIVE_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2';
export const TTS_SAMPLE_RATE = 24_000;

type PackageResolver = () => { installed: boolean; version: string | null };

/** 只读检查本地 TTS 依赖和受管模型，不在状态查询时创建目录。 */
export default class TTSRuntimeService {
  private readonly paths: ManagedPaths;

  private readonly resolvePackage: PackageResolver;

  public constructor(
    paths = ManagedPaths.getInstance(),
    resolvePackage = TTSRuntimeService.resolvePackage,
  ) {
    this.paths = paths;
    this.resolvePackage = resolvePackage;
  }

  public getModelDir(): string {
    return path.join(
      this.paths.getRuntimePaths('tts').modelsRoot,
      TTS_MODEL_NAME,
    );
  }

  public getRequiredFiles(): Record<string, string> {
    const modelDir = this.getModelDir();
    return {
      model: path.join(modelDir, 'model.onnx'),
      voices: path.join(modelDir, 'voices.bin'),
      tokens: path.join(modelDir, 'tokens.txt'),
      dataDir: path.join(modelDir, 'espeak-ng-data'),
      lexiconUs: path.join(modelDir, 'lexicon-us-en.txt'),
      lexiconZh: path.join(modelDir, 'lexicon-zh.txt'),
    };
  }

  public getStatus(): TTSRuntimeStatus {
    const runtimePaths = this.paths.getRuntimePaths('tts');
    const packageInfo = this.resolvePackage();
    const missingFiles = Object.entries(this.getRequiredFiles())
      .filter(([, filePath]) => !fs.existsSync(filePath))
      .map(([name]) => name);
    const modelReady = missingFiles.length === 0;

    return {
      runtimeName: 'sherpa-onnx-node',
      modelName: TTS_MODEL_NAME,
      modelDir: this.getModelDir(),
      archiveUrl: TTS_ARCHIVE_URL,
      packageInstalled: packageInfo.installed,
      packageVersion: packageInfo.version,
      modelReady,
      runtimeReady: packageInfo.installed && modelReady,
      missingFiles,
      speakers: getTTSSpeakers(),
      defaultSpeakerId: DEFAULT_SPEAKER_ID,
      sampleRate: TTS_SAMPLE_RATE,
      manifestPresent: fs.existsSync(runtimePaths.manifestPath),
    };
  }

  private static resolvePackage(): {
    installed: boolean;
    version: string | null;
  } {
    try {
      const info = requireAtRuntime<{
        version?: string;
      }>('sherpa-onnx-node/package.json');
      return { installed: true, version: info.version ?? null };
    } catch {
      return { installed: false, version: null };
    }
  }
}
