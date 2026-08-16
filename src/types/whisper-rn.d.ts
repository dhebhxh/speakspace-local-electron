declare module "whisper.rn" {
  export type ParakeetContext = {
    transcribeData(
      data: ArrayBuffer,
      options?: { maxThreads?: number; audioCtx?: number },
    ): {
      stop: () => Promise<void>;
      promise: Promise<any>;
    };
    release(): Promise<void>;
  };

  export function initParakeet(options: {
    filePath: string | number;
    isBundleAsset?: boolean;
    useGpu?: boolean;
  }): Promise<ParakeetContext>;
}
