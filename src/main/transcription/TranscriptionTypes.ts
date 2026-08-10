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

export type TranscriptionJobStatus =
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TranscriptionJob = {
  id: string;
  source: TranscriptionSource;
  status: TranscriptionJobStatus;
  phase: TranscriptionProgress['phase'];
  statusMessage: string;
  errorMessage: string | null;
  result: TranscriptionResult | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
};
