export type TTSSpeaker = {
  id: number;
  name: string;
  label: string;
  language: string;
  isDefault: boolean;
};

export type TTSRuntimeStatus = {
  runtimeName: 'sherpa-onnx-node';
  modelName: string;
  modelDir: string;
  archiveUrl: string;
  packageInstalled: boolean;
  packageVersion: string | null;
  modelReady: boolean;
  runtimeReady: boolean;
  missingFiles: string[];
  speakers: TTSSpeaker[];
  defaultSpeakerId: number;
  sampleRate: number;
  manifestPresent: boolean;
};
