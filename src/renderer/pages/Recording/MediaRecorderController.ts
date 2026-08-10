const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

/** 封装浏览器 MediaRecorder 生命周期和麦克风资源释放。 */
export default class MediaRecorderController {
  private recorder?: MediaRecorder;

  private stream?: MediaStream;

  public async start(onChunk: (chunk: Blob) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    try {
      const mimeType = MediaRecorderController.selectMimeType();
      this.recorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType } : undefined,
      );
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) onChunk(event.data);
      };
      this.recorder.start(1000);
    } catch (error) {
      this.release();
      throw error;
    }
  }

  public pause(): boolean {
    if (this.recorder?.state !== 'recording') return false;
    this.recorder.pause();
    return true;
  }

  public resume(): boolean {
    if (this.recorder?.state !== 'paused') return false;
    this.recorder.resume();
    return true;
  }

  public stop(): Promise<void> {
    const { recorder } = this;
    if (!recorder || recorder.state === 'inactive') {
      this.release();
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        this.release();
        if (error) reject(error);
        else resolve();
      };

      recorder.addEventListener('stop', () => finish(), { once: true });
      recorder.addEventListener(
        'error',
        () => finish(new Error('Recording device error')),
        { once: true },
      );

      try {
        recorder.stop();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public release(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.recorder = undefined;
  }

  private static selectMimeType(): string | undefined {
    return MIME_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    );
  }
}
