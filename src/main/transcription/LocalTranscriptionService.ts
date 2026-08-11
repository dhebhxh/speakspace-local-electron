import { STTModelManager } from '../AI-module/STTModelManager';
import { PARAKEET_ENGINE } from './STTModelCatalog';
import ParakeetTranscriptionService from './ParakeetTranscriptionService';
import { TranscriptionResult } from './TranscriptionTypes';
import WhisperTranscriptionService, {
  TranscriptionOptions,
} from './WhisperTranscriptionService';

export type TranscriptionBackend = {
  transcribe(
    source: unknown,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
};

/** 根据当前激活模型选择 Whisper 或 Parakeet，IPC 无需知道引擎细节。 */
export default class LocalTranscriptionService implements TranscriptionBackend {
  private readonly models: STTModelManager;

  private readonly whisper: TranscriptionBackend;

  private readonly parakeet: TranscriptionBackend;

  public constructor(
    models = new STTModelManager(),
    whisper: TranscriptionBackend = new WhisperTranscriptionService(),
    parakeet: TranscriptionBackend = new ParakeetTranscriptionService(),
  ) {
    this.models = models;
    this.whisper = whisper;
    this.parakeet = parakeet;
  }

  public transcribe(
    source: unknown,
    options: TranscriptionOptions = {},
  ): Promise<TranscriptionResult> {
    const activeModel = this.models.getActivatedModel();
    if (!activeModel) {
      throw new Error('请先下载并激活一个 STT 模型');
    }
    if (activeModel.engine === PARAKEET_ENGINE) {
      return this.parakeet.transcribe(source, options);
    }
    if (activeModel.engine === 'whisper.cpp') {
      return this.whisper.transcribe(source, options);
    }
    throw new Error(`不支持的 STT 引擎: ${activeModel.engine}`);
  }
}
