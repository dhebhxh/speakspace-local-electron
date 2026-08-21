import type {
  LanguageDetectionResult,
  TranscriptSegment,
  TranscriptionJob,
  TranscriptionLanguage,
  TranscriptionResult,
  TranscriptionSource,
} from '@shared/types/TranscriptionTypes';

export type LiveTranscriptSegment = {
  id: number;
  sourceId?: string;
  text: string;
  engine: TranscriptionResult['engine'];
  modelName: string;
  elapsedMs: number;
};

export type LiveSummarySegment = {
  id: number;
  text: string;
  source: 'llm' | 'local';
};

export type TranscriptionInputMode = 'microphone' | 'file' | null;

export type TranscriptionControllerSnapshot = {
  job: TranscriptionJob | null;
  inputMode: TranscriptionInputMode;
  uploadedFileName: string | null;
  uploadedFilePath: string | null;
  uploadLanguage: TranscriptionLanguage;
  detectedLanguage: LanguageDetectionResult | null;
  languageDetectionPending: boolean;
  languageDetectionError: string | null;
  languageConfirmationRequired: boolean;
  requestPending: boolean;
  requestError: string | null;
  liveSegments: LiveTranscriptSegment[];
  livePendingCount: number;
  liveError: string | null;
  liveSummaries: LiveSummarySegment[];
  summaryPendingCount: number;
  summaryError: string | null;
  summaryMode: 'llm' | 'local' | null;
};

/**
 * 上传 / 录音入口的忙碌判定，录音页和工作台共用同一份口径。
 *
 * 语言检测、请求提交、文件转写 job、实时分段转写，任何一项还在跑都不能
 * 再触发一次：controller 是单实例，二次触发会 resetLive() 覆盖当前状态，
 * 旧 job 的事件随后与新状态交错，用户会看到错文件名或被静默丢弃的结果。
 *
 * includeSummary 把语义整理也算作忙碌。录音页另有 summaryBusy 单独控制
 * 相关按钮，工作台的入口没有对应开关，整理途中重置会丢掉已产出的摘要。
 */
export function isTranscriptionFileBusy(
  snapshot: TranscriptionControllerSnapshot,
  options: { includeSummary?: boolean } = {},
): boolean {
  return (
    snapshot.requestPending ||
    snapshot.job?.status === 'processing' ||
    snapshot.livePendingCount > 0 ||
    snapshot.languageDetectionPending ||
    (options.includeSummary === true && snapshot.summaryPendingCount > 0)
  );
}

type TranscriptionListener = () => void;

type LLMChatResult = {
  content?: string;
};

const MIN_SUMMARY_CHUNKS = 2;
const MAX_SUMMARY_CHUNKS = 5;
const MAX_SUMMARY_CJK_CHARS = 180;
const MAX_SUMMARY_LATIN_CHARS = 430;
const AUTO_CONTINUE_LANGUAGE_CODES = new Set([
  'en',
  'zh',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'pt',
  'it',
  'ru',
  'ar',
  'hi',
]);
const MIN_AUTO_LANGUAGE_CONFIDENCE = 0.65;

const SEMANTIC_BOUNDARY_SYSTEM_PROMPT = [
  'You segment a live speech transcript by meaning.',
  'The input contains everything spoken since the previous summary.',
  'Return exactly WAIT if the speaker is still continuing the same thought, sentence, explanation, list or instruction.',
  'If a coherent idea has naturally finished, or the speaker clearly moves to another topic or action, return exactly one concise summary sentence in the same language as the transcript.',
  'Ignore fillers, repetitions and false starts.',
  'Do not create a summary for a fragment that is too short to carry a complete idea.',
  'Do not add labels, bullets, quotes or explanations.',
].join(' ');

const FORCED_SUMMARY_SYSTEM_PROMPT = [
  'Summarize the supplied live speech transcript as one concise sentence in the same language as the transcript.',
  'Keep only the main completed idea and remove fillers, repetitions and false starts.',
  'Do not add facts, labels, bullets, quotes or explanations.',
].join(' ');

function buildLocalSummary(rawText: string): string {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const withoutFillers = normalized
    .replace(/^(?:啊|嗯|呃|额|那个|就是|然后|所以|好)+[，,。.!！?？\s]*/u, '')
    .replace(/\b(?:um+|uh+|erm+|you know|like)\b[,.!?\s]*/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = withoutFillers || normalized;
  const isMostlyCjk = /[\u3400-\u9fff]/u.test(candidate);
  const limit = isMostlyCjk ? 58 : 150;
  const shortened =
    candidate.length > limit
      ? `${candidate.slice(0, Math.max(1, limit - 1)).trim()}…`
      : candidate;

  return isMostlyCjk ? `本段要点：${shortened}` : `Key point: ${shortened}`;
}

function isBlankTranscript(text: string): boolean {
  const normalized = text.trim();
  return (
    !normalized ||
    /^\[(?:BLANK_AUDIO|SILENCE|MUSIC)\]$/iu.test(normalized) ||
    /^\((?:blank audio|silence|music)\)$/iu.test(normalized)
  );
}

function combinedText(segments: LiveTranscriptSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter((text) => !isBlankTranscript(text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticTextLength(text: string): number {
  return text.replace(/[\s，。！？、,.!?;；:：“”'"()（）[\]]/g, '').length;
}

function shouldConsiderSemanticBoundary(
  segments: LiveTranscriptSegment[],
): boolean {
  if (segments.length < MIN_SUMMARY_CHUNKS) return false;
  const text = combinedText(segments);
  if (!text) return false;
  const isCjk = /[\u3400-\u9fff]/u.test(text);
  return semanticTextLength(text) >= (isCjk ? 24 : 70);
}

function shouldForceSemanticBoundary(
  segments: LiveTranscriptSegment[],
): boolean {
  if (segments.length >= MAX_SUMMARY_CHUNKS) return true;
  const text = combinedText(segments);
  if (!text) return false;
  const isCjk = /[\u3400-\u9fff]/u.test(text);
  return (
    semanticTextLength(text) >=
    (isCjk ? MAX_SUMMARY_CJK_CHARS : MAX_SUMMARY_LATIN_CHARS)
  );
}

function looksLikeLocalSemanticBoundary(
  segments: LiveTranscriptSegment[],
): boolean {
  if (shouldForceSemanticBoundary(segments)) return true;
  if (segments.length < 3) return false;

  const text = combinedText(segments);
  if (!text) return false;
  const lastText = segments.at(-1)?.text.trim() ?? '';
  const hasStrongEnding = /[。！？.!?][”’"')）\]]?$/u.test(lastText);
  const looksLikeContinuation =
    /(?:然后|但是|不过|所以|因为|如果|或者|以及|而且|并且|跟|和|就是|比如|例如|首先|其次|接下来|下一步|and|but|so|because|if|or|also|then|for example|first|second|next)\s*$/iu.test(
      lastText,
    );

  return hasStrongEnding && !looksLikeContinuation;
}

function isWaitResponse(text: string): boolean {
  return /^WAIT[\s.!。！]*$/iu.test(text.trim());
}

/** 连接 Renderer 与主进程转写任务，并管理录音中的短片段实时识别与语义分段总结。 */
export default class TranscriptionController {
  private readonly listeners = new Set<TranscriptionListener>();

  private readonly unsubscribeStatus: () => void;

  private readonly unsubscribePartial: () => void;

  private job: TranscriptionJob | null = null;

  private inputMode: TranscriptionInputMode = null;

  private uploadedFileName: string | null = null;

  private uploadedFilePath: string | null = null;

  private uploadLanguage: TranscriptionLanguage = 'auto';

  private detectedLanguage: LanguageDetectionResult | null = null;

  private languageDetectionPending = false;

  private languageDetectionError: string | null = null;

  private languageConfirmationRequired = false;

  private requestPending = false;

  private requestError: string | null = null;

  private liveSegments: LiveTranscriptSegment[] = [];

  private livePendingCount = 0;

  private liveError: string | null = null;

  private liveSummaries: LiveSummarySegment[] = [];

  private summaryPendingCount = 0;

  private summaryError: string | null = null;

  private summaryMode: 'llm' | 'local' | null = null;

  private summaryBuffer: LiveTranscriptSegment[] = [];

  private summarySequence = 0;

  private summaryCheckScheduled = false;

  private lastSummaryEvaluationTailId = -1;

  private liveGeneration = 0;

  private liveSequence = 0;

  private liveQueue: Promise<void> = Promise.resolve();

  private summaryQueue: Promise<void> = Promise.resolve();

  private llmSummaryAvailable: boolean | null = null;

  public constructor() {
    this.unsubscribeStatus = window.electron.transcription.onStatus((rawJob) =>
      this.receiveStatus(rawJob),
    );
    this.unsubscribePartial = window.electron.transcription.onPartial(
      (payload) => this.receivePartial(payload),
    );
  }

  public getSnapshot(): TranscriptionControllerSnapshot {
    return {
      job: this.job,
      inputMode: this.inputMode,
      uploadedFileName: this.uploadedFileName,
      uploadedFilePath: this.uploadedFilePath,
      uploadLanguage: this.uploadLanguage,
      detectedLanguage: this.detectedLanguage
        ? { ...this.detectedLanguage }
        : null,
      languageDetectionPending: this.languageDetectionPending,
      languageDetectionError: this.languageDetectionError,
      languageConfirmationRequired: this.languageConfirmationRequired,
      requestPending: this.requestPending,
      requestError: this.requestError,
      liveSegments: this.liveSegments.map((segment) => ({ ...segment })),
      livePendingCount: this.livePendingCount,
      liveError: this.liveError,
      liveSummaries: this.liveSummaries.map((summary) => ({ ...summary })),
      summaryPendingCount: this.summaryPendingCount,
      summaryError: this.summaryError,
      summaryMode: this.summaryMode,
    };
  }

  public subscribe(listener: TranscriptionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setUploadLanguage(language: TranscriptionLanguage): void {
    this.uploadLanguage = language;
    this.languageDetectionError = null;
    this.languageConfirmationRequired = false;
    this.notify();
  }

  public dispose(): void {
    this.liveGeneration += 1;
    this.unsubscribeStatus();
    this.unsubscribePartial();
    this.listeners.clear();
  }

  public resetLive(
    inputMode: TranscriptionInputMode = 'microphone',
    uploadedFileName: string | null = null,
    uploadedFilePath: string | null = null,
  ): void {
    this.liveGeneration += 1;
    this.inputMode = inputMode;
    this.uploadedFileName = uploadedFileName;
    this.uploadedFilePath = uploadedFilePath;
    this.detectedLanguage = null;
    this.languageDetectionPending = false;
    this.languageDetectionError = null;
    this.languageConfirmationRequired = false;
    this.job = null;
    this.requestError = null;
    this.liveSequence = 0;
    this.liveSegments = [];
    this.livePendingCount = 0;
    this.liveError = null;
    this.liveSummaries = [];
    this.summaryPendingCount = 0;
    this.summaryError = null;
    this.summaryMode = null;
    this.summaryBuffer = [];
    this.summarySequence = 0;
    this.summaryCheckScheduled = false;
    this.lastSummaryEvaluationTailId = -1;
    this.llmSummaryAvailable = null;
    this.notify();
  }

  public enqueueLiveChunk(chunk: Blob): void {
    if (chunk.size === 0) return;

    const generation = this.liveGeneration;
    const sequence = this.liveSequence;
    this.liveSequence += 1;
    this.livePendingCount += 1;
    this.liveError = null;
    this.notify();

    this.liveQueue = this.liveQueue
      .catch(() => undefined)
      .then(async () => {
        if (generation === this.liveGeneration) {
          try {
            const result = (await window.electron.transcription.liveRun(
              await chunk.arrayBuffer(),
              chunk.type || 'audio/webm',
            )) as TranscriptionResult | null;

            if (generation === this.liveGeneration && result) {
              const segment = {
                id: sequence,
                text: result.text,
                engine: result.engine,
                modelName: result.modelName,
                elapsedMs: result.elapsedMs,
              };
              this.liveSegments = [...this.liveSegments, segment];
              this.addSegmentToSemanticBuffer(segment, generation);
            }
          } catch (error) {
            if (generation === this.liveGeneration) {
              this.liveError =
                error instanceof Error
                  ? error.message
                  : '实时转写失败 / Live transcription failed';
            }
          } finally {
            if (generation === this.liveGeneration) {
              this.livePendingCount = Math.max(0, this.livePendingCount - 1);
              this.notify();
            }
          }
        }

        return undefined;
      });
  }

  /** 停止录音后等待最后一个 STT 片段完成，并强制总结尚未形成自然断点的尾段。 */
  public async finalizeLiveSummary(): Promise<void> {
    const generation = this.liveGeneration;
    await this.liveQueue.catch(() => undefined);
    await this.summaryQueue.catch(() => undefined);

    if (generation !== this.liveGeneration || this.summaryBuffer.length === 0) {
      return;
    }

    const snapshot = [...this.summaryBuffer];
    this.summaryPendingCount = 1;
    this.summaryError = null;
    this.notify();

    try {
      await this.evaluateSemanticBuffer(snapshot, generation, true);
    } finally {
      if (generation === this.liveGeneration) {
        this.summaryPendingCount = 0;
        this.notify();
      }
    }
  }

  public async pickFileAndStart(options?: {
    skipConfirmation?: boolean;
  }): Promise<void> {
    const filePath = (await window.electron.audio.pickFile()) as string | null;
    if (!filePath) return;

    const fileName = filePath.split(/[\\/]/u).pop() || 'audio';
    this.resetLive('file', fileName, filePath);
    await this.startUploadedFile(options?.skipConfirmation);
  }

  public async retranscribeUploadedFile(): Promise<void> {
    if (!this.uploadedFilePath || !this.uploadedFileName) return;

    const filePath = this.uploadedFilePath;
    const fileName = this.uploadedFileName;
    this.resetLive('file', fileName, filePath);
    await this.startUploadedFile();
  }

  private async startUploadedFile(
    skipConfirmation: boolean = false,
  ): Promise<void> {
    const filePath = this.uploadedFilePath;
    if (!filePath) return;

    let language = this.uploadLanguage;
    if (language === 'auto') {
      this.languageDetectionPending = true;
      this.languageDetectionError = null;
      this.notify();

      try {
        const result = (await window.electron.transcription.detectLanguage({
          kind: 'file',
          filePath,
          language: 'auto',
        })) as LanguageDetectionResult;
        this.detectedLanguage = result;
        language = result.language;

        const lowConfidence =
          result.confidence !== null &&
          result.confidence < MIN_AUTO_LANGUAGE_CONFIDENCE;
        const uncommonLanguage = !AUTO_CONTINUE_LANGUAGE_CODES.has(
          result.language,
        );
        const modelFixedLanguage = result.source === 'model-fixed';

        if (
          !skipConfirmation &&
          (lowConfidence || uncommonLanguage || modelFixedLanguage)
        ) {
          this.uploadLanguage = result.language;
          this.languageConfirmationRequired = true;
          return;
        }
      } catch (error) {
        this.languageDetectionError =
          error instanceof Error
            ? error.message
            : '语言检测失败 / Language detection failed';
        if (skipConfirmation) {
          this.requestError = this.languageDetectionError;
        }
        return;
      } finally {
        this.languageDetectionPending = false;
        this.notify();
      }
    } else {
      this.detectedLanguage = null;
      this.languageConfirmationRequired = false;
    }

    await this.start({
      kind: 'file',
      filePath,
      language,
    });
  }

  public startRecording(relativePath: string): Promise<void> {
    return this.start({ kind: 'recording', relativePath });
  }

  /**
   * 彻底放弃当前这一轮采集。
   *
   * 关掉复核窗时用：主进程那边的转写任务要真的取消掉，本地在途的实时分段和
   * 语义整理也要作废，否则它们回来之后还会继续改状态，用户就一直不能重新录。
   */
  public async abort(): Promise<void> {
    const { job } = this;
    // 先 resetLive：liveGeneration 一变，在途的实时/整理回调回来就自动丢弃
    this.resetLive(null);
    if (!job || job.status !== 'processing') return;
    try {
      await window.electron.transcription.cancel(job.id);
    } catch {
      // 任务可能已经自己结束了，取消失败不影响本地状态已经清干净
    }
  }

  public async cancel(): Promise<void> {
    if (!this.job || this.job.status !== 'processing') return;
    await this.runRequest(async () => {
      this.job = (await window.electron.transcription.cancel(
        this.job?.id as string,
      )) as TranscriptionJob;
    });
  }

  public async retry(): Promise<void> {
    if (!this.job || this.job.status === 'processing') return;
    await this.runRequest(async () => {
      this.job = (await window.electron.transcription.retry(
        this.job?.id as string,
      )) as TranscriptionJob;
    });
  }

  private addSegmentToSemanticBuffer(
    segment: LiveTranscriptSegment,
    generation: number,
  ): void {
    if (isBlankTranscript(segment.text)) return;
    this.summaryBuffer = [...this.summaryBuffer, segment];
    this.scheduleSemanticSummaryCheck(generation);
  }

  private scheduleSemanticSummaryCheck(generation: number): void {
    if (generation !== this.liveGeneration || this.summaryCheckScheduled)
      return;
    if (!shouldConsiderSemanticBoundary(this.summaryBuffer)) return;

    const tailId = this.summaryBuffer.at(-1)?.id ?? -1;
    if (tailId <= this.lastSummaryEvaluationTailId) return;

    this.summaryCheckScheduled = true;
    this.summaryPendingCount = 1;
    this.summaryError = null;
    this.notify();

    this.summaryQueue = this.summaryQueue
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this.liveGeneration) return undefined;

        const snapshot = [...this.summaryBuffer];
        if (!shouldConsiderSemanticBoundary(snapshot)) return undefined;

        const snapshotTailId = snapshot.at(-1)?.id ?? -1;
        this.lastSummaryEvaluationTailId = snapshotTailId;
        await this.evaluateSemanticBuffer(
          snapshot,
          generation,
          shouldForceSemanticBoundary(snapshot),
        );

        return undefined;
      })
      .finally(() => {
        if (generation === this.liveGeneration) {
          this.summaryCheckScheduled = false;
          this.summaryPendingCount = 0;
          this.notify();

          // 如果 LLM 判断期间又产生了新的转录片段，再对扩展后的语义缓冲区判断一次。
          this.scheduleSemanticSummaryCheck(generation);
        }
      });
  }

  private async evaluateSemanticBuffer(
    snapshot: LiveTranscriptSegment[],
    generation: number,
    forceSummary: boolean,
  ): Promise<void> {
    const text = combinedText(snapshot);
    if (!text || generation !== this.liveGeneration) return;

    let summaryText = '';
    let source: LiveSummarySegment['source'] = 'local';
    let shouldFlush = forceSummary;

    if (this.llmSummaryAvailable !== false) {
      try {
        const result = (await window.electron.llm.chat(
          [
            {
              role: 'system',
              content: forceSummary
                ? FORCED_SUMMARY_SYSTEM_PROMPT
                : SEMANTIC_BOUNDARY_SYSTEM_PROMPT,
            },
            { role: 'user', content: text },
          ],
          { temperature: 0.1 },
        )) as LLMChatResult;

        const content = result.content?.trim() ?? '';
        this.llmSummaryAvailable = true;

        if (forceSummary) {
          if (content && !isWaitResponse(content)) {
            summaryText = content;
            shouldFlush = true;
            source = 'llm';
          }
        } else if (isWaitResponse(content) || !content) {
          shouldFlush = false;
        } else {
          summaryText = content;
          shouldFlush = true;
          source = 'llm';
        }
      } catch {
        this.llmSummaryAvailable = false;
        this.summaryError =
          '未启用本地 LLM，当前使用轻量语义分段；可在模型管理中启用 Ollama 获得更准确的语义断点判断。';
      }
    }

    if (this.llmSummaryAvailable === false) {
      shouldFlush = forceSummary || looksLikeLocalSemanticBoundary(snapshot);
    }

    if (!shouldFlush || generation !== this.liveGeneration) return;

    if (!summaryText) {
      summaryText = buildLocalSummary(text);
      source = 'local';
    }
    if (!summaryText) return;

    const snapshotTailId = snapshot.at(-1)?.id ?? -1;
    this.summaryBuffer = this.summaryBuffer.filter(
      (segment) => segment.id > snapshotTailId,
    );
    this.liveSummaries = [
      ...this.liveSummaries,
      {
        id: this.summarySequence,
        text: summaryText,
        source,
      },
    ];
    this.summarySequence += 1;
    this.summaryMode = source;
    this.notify();
  }

  private async start(source: TranscriptionSource): Promise<void> {
    await this.runRequest(async () => {
      this.job = (await window.electron.transcription.start(
        source,
      )) as TranscriptionJob;
    });
  }

  private async runRequest(operation: () => Promise<void>): Promise<void> {
    this.requestPending = true;
    this.requestError = null;
    this.notify();

    try {
      await operation();
    } catch (error) {
      this.requestError =
        error instanceof Error
          ? error.message
          : '转写请求失败 / Transcription request failed';
    } finally {
      this.requestPending = false;
      this.notify();
    }
  }

  private receivePartial(rawPayload: unknown): void {
    if (this.inputMode !== 'file') return;
    if (typeof rawPayload !== 'object' || rawPayload === null) return;

    const payload = rawPayload as { jobId?: unknown; segment?: unknown };
    if (typeof payload.jobId !== 'string') return;
    if (!this.job || payload.jobId !== this.job.id) return;
    const segment = TranscriptionController.normalizePartialSegment(
      payload.segment,
    );
    if (!segment) return;

    this.appendFileTranscriptSegment(segment);
  }

  private appendFileTranscriptSegment(segment: TranscriptSegment): void {
    if (isBlankTranscript(segment.text)) return;
    const duplicate = this.liveSegments.some(
      (candidate) => candidate.sourceId === segment.id,
    );
    if (duplicate) return;

    const liveSegment: LiveTranscriptSegment = {
      id: this.liveSequence,
      sourceId: segment.id,
      text: segment.text,
      engine: 'whisper',
      modelName: 'Whisper',
      elapsedMs: 0,
    };
    this.liveSequence += 1;
    this.liveSegments = [...this.liveSegments, liveSegment];
    this.addSegmentToSemanticBuffer(liveSegment, this.liveGeneration);
    this.notify();
  }

  private hydrateFileTranscriptFromFinalResult(job: TranscriptionJob): void {
    if (this.inputMode !== 'file' || !job.result) return;
    if (this.liveSegments.length > 0) return;

    const sourceSegments =
      job.result.segments.length > 0
        ? job.result.segments
        : [
            {
              id: 'final-text',
              startMs: 0,
              endMs: null,
              text: job.result.text,
            },
          ];

    sourceSegments.forEach((segment) =>
      this.appendFileTranscriptSegment(segment),
    );
  }

  private static normalizePartialSegment(
    rawSegment: unknown,
  ): TranscriptSegment | null {
    if (typeof rawSegment !== 'object' || rawSegment === null) return null;
    const segment = rawSegment as Partial<TranscriptSegment>;
    if (typeof segment.text !== 'string' || !segment.text.trim()) return null;

    return {
      id: typeof segment.id === 'string' ? segment.id : `partial-${Date.now()}`,
      startMs:
        typeof segment.startMs === 'number' && Number.isFinite(segment.startMs)
          ? segment.startMs
          : 0,
      endMs:
        typeof segment.endMs === 'number' && Number.isFinite(segment.endMs)
          ? segment.endMs
          : null,
      text: segment.text.trim(),
    };
  }

  private receiveStatus(rawJob: unknown): void {
    if (typeof rawJob !== 'object' || rawJob === null) return;
    const job = rawJob as TranscriptionJob;
    // 状态事件是全局广播的。只认自己发起的那个任务：
    // 否则新建的 controller（比如关掉复核窗后重建的那个）会把上一轮
    // 还没结束的任务认领过来，界面立刻变成「转写中」，录音和上传都点不动。
    if (!this.job || job.id !== this.job.id) return;

    this.job = job;
    if (this.inputMode === 'file' && job.status === 'completed') {
      this.hydrateFileTranscriptFromFinalResult(job);
      this.finalizeLiveSummary().catch(() => undefined);
    }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
