export type LocalLlmOperation =
  | "core-insights"
  | "knowledge"
  | "knowledge-template"
  | "note-classification"
  | "ask-ai"
  | "model-management";
export type LocalInferenceOperation = LocalLlmOperation | "transcription";

export type LocalInferenceSnapshot = {
  activeOperation: LocalInferenceOperation | null;
  pendingCount: number;
};

/**
 * llama.rn contexts share the same constrained mobile CPU and memory budget.
 * Keep native inference work process-wide and FIFO so independently mounted
 * screens cannot run completions concurrently.
 */
export class LocalLlmCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private activeOperation: LocalInferenceOperation | null = null;
  private readonly idleCleanups = new Map<LocalInferenceOperation, () => Promise<void>>();
  private readonly listeners = new Set<(snapshot: LocalInferenceSnapshot) => void>();
  private stopSpeechPlayback: (() => Promise<void>) | null = null;
  private nextJobId = 1;
  private pendingCount = 0;

  public getActiveOperation(): LocalInferenceOperation | null {
    return this.activeOperation;
  }

  public getSnapshot(): LocalInferenceSnapshot {
    return { activeOperation: this.activeOperation, pendingCount: this.pendingCount };
  }

  public isBusy(): boolean {
    return this.activeOperation !== null || this.pendingCount > 0;
  }

  public subscribe(listener: (snapshot: LocalInferenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public registerSpeechPlaybackStopper(stop: () => Promise<void>): () => void {
    this.stopSpeechPlayback = stop;
    return () => {
      if (this.stopSpeechPlayback === stop) this.stopSpeechPlayback = null;
    };
  }

  public registerIdleCleanup(operation: LocalInferenceOperation, cleanup: () => Promise<void>): void {
    this.idleCleanups.set(operation, cleanup);
  }

  public async runExclusive<T>(
    operation: LocalInferenceOperation,
    task: () => Promise<T>,
  ): Promise<T> {
    const release = await this.acquire(operation);
    try {
      return await task();
    } finally {
      release();
    }
  }

  public async acquire(operation: LocalInferenceOperation): Promise<() => void> {
    const jobId = this.nextJobId++;
    const queuedAt = Date.now();
    const queuedBehind = this.activeOperation;
    this.pendingCount += 1;
    this.publish();
    console.info("[LocalInference] Operation queued", { jobId, operation, queuedBehind, pendingCount: this.pendingCount });

    let release!: () => void;
    const turn = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.tail;
    this.tail = previous.catch(() => undefined).then(() => turn);

    try {
      await this.stopSpeechPlayback?.();
    } catch (error) {
      console.warn("[LocalInference] Speech playback cleanup failed; continuing with queued work.", { error });
    }

    await previous.catch(() => undefined);
    this.activeOperation = operation;
    this.publish();
    console.info("[LocalInference] Operation acquired execution slot", { jobId, operation, waitDurationMs: Date.now() - queuedAt, pendingCount: this.pendingCount });
    const executionStartedAt = Date.now();
    try {
      for (const [owner, cleanup] of this.idleCleanups) {
        if (owner !== operation) {
          const cleanupStartedAt = Date.now();
          console.info("[LocalInference] Releasing idle resources", { jobId, operation, resourceOwner: owner });
          await cleanup();
          console.info("[LocalInference] Idle resources released", { jobId, operation, resourceOwner: owner, durationMs: Date.now() - cleanupStartedAt });
        }
      }
    } catch (error) {
      this.pendingCount -= 1;
      this.activeOperation = null;
      this.publish();
      release();
      throw error;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.pendingCount -= 1;
      console.info("[LocalInference] Operation released execution slot", { jobId, operation, executionDurationMs: Date.now() - executionStartedAt, pendingCount: this.pendingCount });
      this.activeOperation = null;
      this.publish();
      release();
    };
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
