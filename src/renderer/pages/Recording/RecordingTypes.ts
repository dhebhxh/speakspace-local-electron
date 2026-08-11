export enum RecordingState {
  Idle = 'idle',
  Recording = 'recording',
  Paused = 'paused',
  Completed = 'completed',
  Saved = 'saved',
}

export type SavedRecording = {
  relativePath: string;
  mimeType: string;
  byteLength: number;
  createdAt: string;
};

export type RecordingSnapshot = {
  state: RecordingState;
  busy: boolean;
  statusMessage: string;
  errorMessage: string | null;
  bufferedBytes: number;
  savedRecording: SavedRecording | null;
};

export type RecordingListener = () => void;
