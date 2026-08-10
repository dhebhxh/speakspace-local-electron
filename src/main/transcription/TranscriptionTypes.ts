export type TranscriptionSource =
  | { kind: 'file'; filePath: string }
  | { kind: 'recording'; relativePath: string };

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number | null;
  text: string;
};

export type TranscriptionProgress = {
  phase: 'preparing' | 'transcribing' | 'completed';
  message: string;
};

export type TranscriptionResult = {
  text: string;
  segments: TranscriptSegment[];
  engine: 'whisper';
  modelId: string;
  modelName: string;
  elapsedMs: number;
};
