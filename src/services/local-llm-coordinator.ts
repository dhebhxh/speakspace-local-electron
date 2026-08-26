export type LocalLlmOperation =
  | "core-insights"
  | "knowledge"
  | "knowledge-template"
  | "note-classification"
  | "ask-ai"
  | "translation"
  | "model-management";
export type LocalInferenceOperation = LocalLlmOperation | "transcription";
type IdleResourceOwner = LocalInferenceOperation | "shared-llm";

export type LocalInferenceSnapshot = {
  activeOperation: LocalInferenceOperation | null;
  pendingCount: number;
};

type AcquireOptions = { signal?: AbortSignal };
type QueueJob = {
  id: number;
  operation: LocalInferenceOperation;
  queuedAt: number;
  signal?: AbortSignal;
  abortListener?: () => void;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
};

function cancellationError(): Error {
  const error = new Error("The queued local operation was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * Native model contexts share a constrained mobile CPU and memory budget.
 * This process-wide FIFO owns one explicit queue so a queued request can be
 * removed immediately when its end-to-end deadline expires.
 */
export class LocalLlmCoordinator {
  private activeJob: QueueJob | null = null;
  private isStartingJob = false;
  private readonly queue: QueueJob[] = [];
  private readonly idleCleanups = new Map<IdleResourceOwner, { cleanup: () => Promise<void>; compatibleOperations: ReadonlySet<LocalInferenceOperation> }>();
  private readonly listeners = new Set<(snapshot: LocalInferenceSnapshot) => void>();
  private stopSpeechPlayback: (() => Promise<void>) | null = null;
  private nextJobId = 1;
  private pendingCount = 0;

  public getActiveOperation(): LocalInferenceOperation | null {
    return this.activeJob?.operation ?? null;
  }

  public getSnapshot(): LocalInferenceSnapshot {
    return { activeOperation: this.getActiveOperation(), pendingCount: this.pendingCount };
  }

  public isBusy(): boolean {
    return this.activeJob !== null || this.isStartingJob || this.pendingCount > 0;
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

  public registerIdleCleanup(
    owner: IdleResourceOwner,
    cleanup: () => Promise<void>,
    compatibleOperations: readonly LocalInferenceOperation[] = [owner as LocalInferenceOperation],
  ): void {
    this.idleCleanups.set(owner, { cleanup, compatibleOperations: new Set(compatibleOperations) });
  }

  public async runExclusive<T>(
    operation: LocalInferenceOperation,
    task: () => Promise<T>,
    options: AcquireOptions = {},
  ): Promise<T> {
    const release = await this.acquire(operation, options);
    let releaseAfterTaskSettles = false;
    try {
      if (options.signal?.aborted) throw cancellationError();
      const taskPromise = Promise.resolve().then(task);
      if (!options.signal) return await taskPromise;

      let abortListener: (() => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        abortListener = () => reject(cancellationError());
        options.signal!.addEventListener("abort", abortListener, { once: true });
      });
      try {
        return await Promise.race([taskPromise, abortPromise]);
      } catch (error) {
        if (options.signal.aborted) {
          // Return the timeout/cancellation to the caller immediately, but keep
          // the serialized native slot until a non-cancellable native await has
          // actually unwound. This prevents a second model context overlapping it.
          releaseAfterTaskSettles = true;
          void taskPromise.then(release, release);
          throw cancellationError();
        }
        throw error;
      } finally {
        if (abortListener) options.signal.removeEventListener("abort", abortListener);
      }
    } finally {
      if (!releaseAfterTaskSettles) release();
    }
  }

  public acquire(operation: LocalInferenceOperation, options: AcquireOptions = {}): Promise<() => void> {
    if (options.signal?.aborted) return Promise.reject(cancellationError());
    const id = this.nextJobId++;
    const queuedAt = Date.now();
    const queuedBehind = this.activeJob?.operation ?? this.queue.at(-1)?.operation ?? null;
    this.pendingCount += 1;

    const promise = new Promise<() => void>((resolve, reject) => {
      const job: QueueJob = { id, operation, queuedAt, signal: options.signal, resolve, reject };
      if (options.signal) {
        job.abortListener = () => {
          const index = this.queue.indexOf(job);
          if (index < 0) return;
          this.queue.splice(index, 1);
          this.pendingCount -= 1;
          options.signal?.removeEventListener("abort", job.abortListener!);
          console.info("[LocalInference] Cancelled queued operation", { jobId: id, operation, pendingCount: this.pendingCount });
          job.reject(cancellationError());
          this.publish();
          void this.drain();
        };
        options.signal.addEventListener("abort", job.abortListener, { once: true });
      }
      this.queue.push(job);
    });

    console.info("[LocalInference] Operation queued", { jobId: id, operation, queuedBehind, pendingCount: this.pendingCount });
    this.publish();
    void this.drain();
    return promise;
  }

  private async drain(): Promise<void> {
    if (this.activeJob !== null || this.isStartingJob) return;
    const job = this.queue.shift();
    if (!job) return;
    this.isStartingJob = true;
    this.activeJob = job;
    this.publish();

    try {
      try {
        await this.stopSpeechPlayback?.();
      } catch (error) {
        console.warn("[LocalInference] Speech playback cleanup failed; continuing with queued work.", { error });
      }
      if (job.signal?.aborted) throw cancellationError();

      for (const [owner, resource] of this.idleCleanups) {
        if (resource.compatibleOperations.has(job.operation)) continue;
        const cleanupStartedAt = Date.now();
        console.info("[LocalInference] Releasing idle resources", { jobId: job.id, operation: job.operation, resourceOwner: owner });
        await resource.cleanup();
        console.info("[LocalInference] Idle resources released", { jobId: job.id, operation: job.operation, resourceOwner: owner, durationMs: Date.now() - cleanupStartedAt });
        if (job.signal?.aborted) throw cancellationError();
      }

      this.isStartingJob = false;
      const executionStartedAt = Date.now();
      console.info("[LocalInference] Operation acquired execution slot", { jobId: job.id, operation: job.operation, waitDurationMs: executionStartedAt - job.queuedAt, pendingCount: this.pendingCount });
      let released = false;
      job.resolve(() => {
        if (released) return;
        released = true;
        job.signal?.removeEventListener("abort", job.abortListener!);
        this.pendingCount -= 1;
        console.info("[LocalInference] Operation released execution slot", { jobId: job.id, operation: job.operation, executionDurationMs: Date.now() - executionStartedAt, pendingCount: this.pendingCount });
        this.activeJob = null;
        this.publish();
        void this.drain();
      });
    } catch (error) {
      job.signal?.removeEventListener("abort", job.abortListener!);
      this.pendingCount -= 1;
      this.activeJob = null;
      this.isStartingJob = false;
      job.reject(error instanceof Error ? error : new Error("Unable to start the local operation."));
      this.publish();
      void this.drain();
    }
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
