export type TtsModelCatalogEntry = {
  id: string;
  name: string;
  description: string;
  modelType: "vits";
  languages: readonly string[];
  sizeBytes: number;
  speakers: string;
};

/** Curated sherpa-onnx release models that are practical for local mobile use. */
export const TTS_MODEL_CATALOG: readonly TtsModelCatalogEntry[] = [
  {
    id: "vits-icefall-zh-aishell3",
    name: "AISHELL3 Chinese",
    description: "Smallest Chinese option, with 174 voices and very fast synthesis.",
    modelType: "vits",
    languages: ["Chinese"],
    sizeBytes: 30 * 1024 * 1024,
    speakers: "174 voices",
  },
  {
    id: "vits-piper-zh_CN-huayan-medium",
    name: "Piper Huayan Chinese",
    description: "Compact Mandarin voice with a good quality and speed balance.",
    modelType: "vits",
    languages: ["Chinese"],
    sizeBytes: 63 * 1024 * 1024,
    speakers: "1 voice",
  },
  {
    id: "vits-piper-en_US-lessac-medium",
    name: "Piper Lessac English",
    description: "Fast, compact US English voice well suited to phones.",
    modelType: "vits",
    languages: ["English (US)"],
    sizeBytes: 61 * 1024 * 1024,
    speakers: "1 voice",
  },
  {
    id: "vits-melo-tts-zh_en",
    name: "MeloTTS Chinese + English",
    description: "Bilingual Chinese and English voice with a larger quality-focused model.",
    modelType: "vits",
    languages: ["Chinese", "English"],
    sizeBytes: 163 * 1024 * 1024,
    speakers: "1 voice",
  },
];
