import {
  TranscriptionJob,
  TranscriptionResult,
  TranscriptionSource,
} from '../../../main/transcription/TranscriptionTypes';

export type LiveTranscriptSegment = {
  id: number;
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

export type TranscriptionControllerSnapshot = {
  job: TranscriptionJob | null;
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

type TranscriptionListener = () => void;

type LLMChatResult = {
  content?: string;
};

const MIN_SUMMARY_CHUNKS = 2;
const MAX_SUMMARY_CHUNKS = 5;
const MAX_SUMMARY_CJK_CHARS = 180;
const MAX_SUMMARY_LATIN_CHARS = 430;

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

  private job: TranscriptionJob | null = null;

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
  }

  public getSnapshot(): TranscriptionControllerSnapshot {
    return {
      job: this.job,
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

  public dispose(): void {
    this.liveGeneration += 1;
    this.unsubscribeStatus();
    this.listeners.clear();
  }

  public resetLive(): void {
    this.liveGeneration += 1;
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

  public async pickFileAndStart(): Promise<void> {
    const filePath = (await window.electron.audio.pickFile()) as string | null;
    if (!filePath) return;
    await this.start({ kind: 'file', filePath });
  }

  public startRecording(relativePath: string): Promise<void> {
    return this.start({ kind: 'recording', relativePath });
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

  private receiveStatus(rawJob: unknown): void {
    if (typeof rawJob !== 'object' || rawJob === null) return;
    const job = rawJob as TranscriptionJob;
    if (this.job && job.id !== this.job.id) return;

    this.job = job;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
