import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const insightPath = new URL("../src/services/core-note-insight-service.ts", import.meta.url);
const knowledgePath = new URL("../src/services/knowledge-service.ts", import.meta.url);

test("Structured Note uses bounded mobile stages, a sparse fast path, and a deadline", async () => {
  const source = await readFile(insightPath, "utf8");
  assert.match(source, /contextSize: CONTEXT_SIZE, stages: 2/);
  assert.match(source, /n_gpu_layers: GPU_LAYERS/);
  assert.match(source, /use_mmap: true/);
  assert.match(source, /CONTENT_TOKENS = 320/);
  assert.match(source, /INTENT_TOKENS = 448/);
  assert.match(source, /GENERATION_TIMEOUT_MS = 120_000/);
  assert.match(source, /maxItems: 6/);
  assert.match(source, /Sparse grounded result saved without model inference/);
  assert.match(source, /Short grounded result saved without model inference/);
  assert.doesNotMatch(source, /stopCompletion\(\)\.catch/);
});

test("Knowledge uses the bounded mobile inference configuration", async () => {
  const source = await readFile(knowledgePath, "utf8");
  assert.match(source, /MODEL_CONTEXT_SIZE = 4096/);
  assert.match(source, /MAX_PREDICTED_TOKENS = 768/);
  assert.match(source, /n_gpu_layers: GPU_LAYERS/);
  assert.match(source, /GENERATION_TIMEOUT_MS = 120_000/);
  assert.match(source, /maxItems: 8/);
  assert.match(source, /Sparse grounded result saved without model inference/);
  assert.match(source, /Short grounded result saved without model inference/);
  assert.doesNotMatch(source, /stopCompletion\(\)\.catch/);
});
