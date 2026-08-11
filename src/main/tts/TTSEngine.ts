import os from 'os';
import TTSRuntimeService from './TTSRuntimeService';

type GeneratedAudio = { samples: Float32Array; sampleRate: number };
type OfflineTts = {
  generateAsync(request: {
    text: string;
    sid: number;
    speed: number;
    enableExternalBuffer: boolean;
  }): Promise<GeneratedAudio>;
};
type SherpaModule = {
  OfflineTts: { createAsync(config: unknown): Promise<OfflineTts> };
};
type ModuleLoader = () => SherpaModule;

/** 缓存异步创建的 Kokoro 引擎；生成工作由原生异步接口执行。 */
export default class TTSEngine {
  private enginePromise: Promise<OfflineTts> | null = null;

  private readonly runtime: TTSRuntimeService;

  private readonly loadModule: ModuleLoader;

  public constructor(
    runtime: TTSRuntimeService,
    loadModule: ModuleLoader = TTSEngine.requireModule,
  ) {
    this.runtime = runtime;
    this.loadModule = loadModule;
  }

  public async generate(
    text: string,
    speakerId: number,
    speed: number,
  ): Promise<GeneratedAudio> {
    const engine = await this.getEngine();
    const generated = await engine.generateAsync({
      text,
      sid: speakerId,
      speed,
      enableExternalBuffer: false,
    });
    if (!generated?.samples?.length || !generated.sampleRate) {
      throw new Error('本地 TTS 没有返回音频 / TTS returned no audio');
    }
    // 脱离原生缓冲区后再通过 Electron IPC 传递。
    return {
      samples: Float32Array.from(generated.samples),
      sampleRate: generated.sampleRate,
    };
  }

  public dispose(): void {
    this.enginePromise = null;
  }

  private getEngine(): Promise<OfflineTts> {
    if (!this.enginePromise) {
      const required = this.runtime.getRequiredFiles();
      const config = {
        model: {
          kokoro: {
            model: required.model,
            voices: required.voices,
            tokens: required.tokens,
            dataDir: required.dataDir,
            lexicon: `${required.lexiconUs},${required.lexiconZh}`,
          },
        },
        numThreads: Math.max(1, Math.min(os.cpus().length - 1, 4)),
        maxNumSentences: 1,
        silenceScale: 0.2,
        provider: 'cpu',
      };
      this.enginePromise = this.loadModule().OfflineTts.createAsync(config);
    }
    return this.enginePromise;
  }

  private static requireModule(): SherpaModule {
    // 原生依赖位于 release/app，并由 webpack 标记为 external。
    // eslint-disable-next-line global-require
    return require('sherpa-onnx-node') as SherpaModule;
  }
}
