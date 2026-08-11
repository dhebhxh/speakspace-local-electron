import TTSRuntimeService, { TTS_MODEL_NAME } from './TTSRuntimeService';
import TTSEngine from './TTSEngine';
import { normalizeTTSInput } from './TTSInput';
import { getTTSSpeakers } from './TTSVoices';

export type TTSAudioResult = {
  source: 'local';
  backend: 'sherpa-onnx-node';
  modelName: string;
  speakerId: number;
  speakerName: string;
  sampleRate: number;
  samples: Float32Array;
};

/** 验证运行时与输入后执行本地合成，结果不写入磁盘。 */
export default class TTSService {
  private readonly runtime: TTSRuntimeService;

  private readonly engine: TTSEngine;

  public constructor(
    runtime = new TTSRuntimeService(),
    engine = new TTSEngine(runtime),
  ) {
    this.runtime = runtime;
    this.engine = engine;
  }

  public async synthesize(
    rawText: unknown,
    rawOptions: unknown,
  ): Promise<TTSAudioResult> {
    const status = this.runtime.getStatus();
    if (!status.runtimeReady) {
      throw new Error('请先在模型管理中安装 Kokoro TTS 模型');
    }
    const input = normalizeTTSInput(rawText, rawOptions);
    const speaker = getTTSSpeakers().find(
      (candidate) => candidate.id === input.speakerId,
    );
    if (!speaker) throw new Error('TTS 音色不存在 / Speaker not found');
    const audio = await this.engine.generate(
      input.text,
      input.speakerId,
      input.speed,
    );
    return {
      source: 'local',
      backend: 'sherpa-onnx-node',
      modelName: TTS_MODEL_NAME,
      speakerId: speaker.id,
      speakerName: speaker.name,
      sampleRate: audio.sampleRate,
      samples: audio.samples,
    };
  }

  public dispose(): void {
    this.engine.dispose();
  }
}
