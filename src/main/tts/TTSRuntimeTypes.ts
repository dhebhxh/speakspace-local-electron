export type TTSSpeaker = {
  id: string;
  name: string;
  label: string;
  language: string;
  isDefault: boolean;
};

export type TTSRuntimeDependencyStatus = {
  id: 'sherpa-onnx-node' | 'onnxruntime-node' | 'sentencepiece-js';
  name: string;
  installed: boolean;
  version: string | null;
};

export type TTSRuntimeStatus = {
  runtimeName: 'local-onnx';
  activeModelId: string | null;
  activeBackend: string | null;
  modelName: string | null;
  modelDir: string | null;
  packageInstalled: boolean;
  packageVersion: string | null;
  modelReady: boolean;
  runtimeReady: boolean;
  missingFiles: string[];
  speakers: TTSSpeaker[];
  defaultSpeakerId: string | null;
  sampleRate: number;
  manifestPresent: boolean;
  installedModelCount: number;
  runtimes: TTSRuntimeDependencyStatus[];
};
