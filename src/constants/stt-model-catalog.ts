import type { SttModelEngine } from "@/domain/stt-model/stt-model";

/**
 * Directory (relative to the app's document directory) where downloaded
 * STT model files are stored on disk.
 */
export const STT_MODELS_DIRECTORY_NAME = "stt-models";

export type SttModelCatalogEntry = {
  /** Stable identifier, also used as the primary key once installed. */
  id: string;
  /**
   * Inference engine required to load the model. `whisper.rn` currently
   * loads Parakeet GGUF models through `initParakeet`. Adding support for
   * another engine (for example classic Whisper ggml models) only requires
   * adding new catalog entries plus a matching load path in
   * `SttModelService` - the catalog itself is never limited to one model.
   */
  engine: SttModelEngine;
  name: string;
  description: string;
  format: string;
  quantization: string | null;
  sizeBytes: number;
  /** Exact expected download size when the supplier publishes one. */
  expectedSizeBytes?: number;
  fileName: string;
  downloadUrl: string;
  /** Language hint passed to Whisper. Omitted for engines that do not use it. */
  transcriptionLanguage?: string;
};

/**
 * Downloadable STT models, sourced from the `ggml-org/parakeet-GGUF`
 * Hugging Face repository. Each quantization is a separate entry so users
 * can pick the size/accuracy trade-off they want, and more entries (or
 * models from other repositories/engines) can be appended here freely.
 */
export const STT_MODEL_CATALOG: readonly SttModelCatalogEntry[] = [
  {
    id: "parakeet-tdt-0.6b-v3-q4_0",
    engine: "parakeet",
    name: "Parakeet TDT 0.6B v3 (Q4_0)",
    description:
      "NVIDIA Parakeet TDT 0.6B v3, 4-bit quantized. Smallest and fastest option.",
    format: "GGUF",
    quantization: "Q4_0",
    sizeBytes: 356 * 1024 * 1024,
    fileName: "ggml-parakeet-tdt-0.6b-v3-q4_0.bin",
    downloadUrl:
      "https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q4_0.bin?download=true",
  },
  {
    id: "parakeet-tdt-0.6b-v3-q4_k",
    engine: "parakeet",
    name: "Parakeet TDT 0.6B v3 (Q4_K)",
    description:
      "NVIDIA Parakeet TDT 0.6B v3, 4-bit k-quant. Balanced size and accuracy.",
    format: "GGUF",
    quantization: "Q4_K",
    sizeBytes: 416 * 1024 * 1024,
    fileName: "ggml-parakeet-tdt-0.6b-v3-q4_k.bin",
    downloadUrl:
      "https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q4_k.bin?download=true",
  },
  {
    id: "parakeet-tdt-0.6b-v3-q8_0",
    engine: "parakeet",
    name: "Parakeet TDT 0.6B v3 (Q8_0)",
    description:
      "NVIDIA Parakeet TDT 0.6B v3, 8-bit quantized. Higher accuracy, larger download.",
    format: "GGUF",
    quantization: "Q8_0",
    sizeBytes: 669 * 1024 * 1024,
    fileName: "ggml-parakeet-tdt-0.6b-v3-q8_0.bin",
    downloadUrl:
      "https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin?download=true",
  },
  {
    id: "parakeet-tdt-0.6b-v3-f16",
    engine: "parakeet",
    name: "Parakeet TDT 0.6B v3 (F16)",
    description:
      "NVIDIA Parakeet TDT 0.6B v3, full 16-bit precision. Best accuracy, largest download.",
    format: "GGUF",
    quantization: "F16",
    sizeBytes: Math.round(1.26 * 1024 * 1024 * 1024),
    fileName: "ggml-parakeet-tdt-0.6b-v3-f16.bin",
    downloadUrl:
      "https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-f16.bin?download=true",
  },
  {
    id: "whisper-small-multilingual-f16",
    engine: "whisper",
    name: "Whisper Small Multilingual (F16)",
    description:
      "Full-precision multilingual Whisper small for Chinese compatibility testing.",
    format: "GGML",
    quantization: "F16",
    sizeBytes: 487_601_967,
    expectedSizeBytes: 487_601_967,
    fileName: "ggml-small.bin",
    downloadUrl:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true",
    transcriptionLanguage: "zh",
  },
];
