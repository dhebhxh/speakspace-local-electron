export type LocalLlmOperation = "core-insights" | "knowledge" | "ask-ai" | "model-management";

/**
 * llama.rn contexts share the same constrained mobile CPU and memory budget.
 * Keep native inference work process-wide and FIFO so independently mounted
 * screens cannot run completions concurrently.
 */
export class LocalLlmCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private activeOperation: LocalLlmOperation | null = null;
  private readonly idleCleanups = new Map<LocalLlmOperation, () => Promise<void>>();
  private nextJobId = 1;
  private pendingCount = 0;

  public getActiveOperation(): LocalLlmOperation | null {
    return this.activeOperation;
  }

  public registerIdleCleanup(operation: LocalLlmOperation, cleanup: () => Promise<void>): void {
    this.idleCleanups.set(operation, cleanup);
  }

  public async runExclusive<T>(
    operation: LocalLlmOperation,
    task: () => Promise<T>,
  ): Promise<T> {
    const jobId = this.nextJobId++;
    const queuedAt = Date.now();
    const queuedBehind = this.activeOperation;
    this.pendingCount += 1;
    console.info("[LocalLLM] Operation queued", { jobId, operation, queuedBehind, pendingCount: this.pendingCount });
    let release!: () => void;
    const turn = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.tail;
    this.tail = previous.catch(() => undefined).then(() => turn);

    await previous.catch(() => undefined);
    this.activeOperation = operation;
    console.info("[LocalLLM] Operation acquired execution slot", { jobId, operation, waitDurationMs: Date.now() - queuedAt, pendingCount: this.pendingCount });
    const executionStartedAt = Date.now();
    try {
      for (const [owner, cleanup] of this.idleCleanups) {
        if (owner !== operation) {
          const cleanupStartedAt = Date.now();
          console.info("[LocalLLM] Releasing idle resources", { jobId, operation, resourceOwner: owner });
          await cleanup();
          console.info("[LocalLLM] Idle resources released", { jobId, operation, resourceOwner: owner, durationMs: Date.now() - cleanupStartedAt });
        }
      }
      return await task();
    } finally {
      this.pendingCount -= 1;
      console.info("[LocalLLM] Operation released execution slot", { jobId, operation, executionDurationMs: Date.now() - executionStartedAt, pendingCount: this.pendingCount });
      this.activeOperation = null;
      release();
    }
  }
}
