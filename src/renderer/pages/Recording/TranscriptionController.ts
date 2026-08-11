import {
  TranscriptionJob,
  TranscriptionSource,
} from '../../../main/transcription/TranscriptionTypes';

export type TranscriptionControllerSnapshot = {
  job: TranscriptionJob | null;
  requestPending: boolean;
  requestError: string | null;
};

type TranscriptionListener = () => void;

/** 连接 Renderer 与主进程转写任务，不包含录音设备状态。 */
export default class TranscriptionController {
  private readonly listeners = new Set<TranscriptionListener>();

  private readonly unsubscribeStatus: () => void;

  private job: TranscriptionJob | null = null;

  private requestPending = false;

  private requestError: string | null = null;

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
    };
  }

  public subscribe(listener: TranscriptionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.unsubscribeStatus();
    this.listeners.clear();
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
