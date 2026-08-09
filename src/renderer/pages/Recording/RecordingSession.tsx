export enum RecordingState {
  Idle = 'idle',
  Recording = 'recording',
  Paused = 'paused',
  Completed = 'completed',
}

export class RecordingSession {
  private recorder?: MediaRecorder;

  private state = RecordingState.Idle;

  private listeners: Array<() => void> = [];

  public transcript = '';

  public getState(): RecordingState {
    return this.state;
  }

  public async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    this.recorder = new MediaRecorder(stream);

    this.recorder.ondataavailable = (event) => {
      this.sendAudioChunk(event.data);
    };

    this.recorder.start(1000);

    this.state = RecordingState.Recording;
    this.notify();
  }

  public pause(): void {
    this.recorder?.pause();

    this.state = RecordingState.Paused;
    this.notify();
  }

  public resume(): void {
    this.recorder?.resume();

    this.state = RecordingState.Recording;
    this.notify();
  }

  public stop(): void {
    this.recorder?.stop();

    this.state = RecordingState.Completed;
    this.notify();
  }

  public save(): void {
    // TODO IPC: save recording

    this.state = RecordingState.Idle;
    this.notify();
  }

  public discard(): void {
    // TODO IPC: discard recording

    this.state = RecordingState.Idle;
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (currentListener) => currentListener !== listener,
      );
    };
  }

  private async sendAudioChunk(blob: Blob) {
    await blob.arrayBuffer();

    // TODO IPC
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  // 增加状态检查
}
