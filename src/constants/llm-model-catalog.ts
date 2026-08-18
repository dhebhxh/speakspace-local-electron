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
    id: "llama-3.2-1b-instruct-q4-k-m",
    engine: "llama.rn",
    name: "Llama 3.2 1B Instruct",
    description:
      "Small mobile model with solid general instruction-following quality.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 808_000_000,
    fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true",
  },
  {
    id: "qwen2.5-1.5b-instruct-q4-k-m",
    engine: "llama.rn",
    name: "Qwen2.5 1.5B Instruct",
    description:
      "Stronger multilingual model with better Chinese and English reasoning than the 1B options.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 986_000_000,
    fileName: "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf?download=true",
  },
  {
    id: "gemma-2-2b-it-q4-k-m",
    engine: "llama.rn",
    name: "Gemma 2 2B Instruct",
    description:
      "Higher-quality general-purpose model with better writing and summarization than smaller options.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 1_708_000_000,
    fileName: "gemma-2-2b-it-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true",
  },
  {
    id: "llama-3.2-3b-instruct-q4-k-m",
    engine: "llama.rn",
    name: "Llama 3.2 3B Instruct",
    description:
      "Largest and most capable option here; best instruction-following at the cost of more storage and slower inference.",
    format: "GGUF",
    quantization: "Q4_K_M",
    sizeBytes: 2_019_000_000,
    fileName: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf?download=true",
  },
];
