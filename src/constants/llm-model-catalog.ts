import type { LlmModelEngine } from "@/domain/llm-model/llm-model";

export const LLM_MODELS_DIRECTORY_NAME = "llm-models";

export type LlmModelCatalogEntry = {
  id: string;
  engine: LlmModelEngine;
  name: string;
  description: string;
  format: string;
  quantization: string;
  sizeBytes: number;
  fileName: string;
  downloadUrl: string;
};

/**
 * Small, instruction-tuned GGUF models suitable for initial on-device use.
 * Q4_K_M provides a useful quality/size trade-off and is supported by
 * llama.cpp, which is the inference backend used by llama.rn.
 */
export const LLM_MODEL_CATALOG: readonly LlmModelCatalogEntry[] = [
  {
    id: "smollm2-360m-instruct-q4-k-m",
    engine: "llama.rn",
    name: "SmolLM2 360M Instruct",
    description: "Smallest and fastest option for lightweight English tasks.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 271_000_000,
    fileName: "SmolLM2-360M-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf?download=true",
  },
  {
    id: "qwen2.5-0.5b-instruct-q4-k-m",
    engine: "llama.rn",
    name: "Qwen2.5 0.5B Instruct",
    description: "Compact multilingual model with strong Chinese and English support.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 398_000_000,
    fileName: "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf?download=true",
  },
  {
    id: "llama-3.2-1b-instruct-q4-k-m",
    engine: "llama.rn",
    name: "Llama 3.2 1B Instruct",
    description: "Larger mobile model with better general instruction-following quality.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 808_000_000,
    fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true",
  },
];
