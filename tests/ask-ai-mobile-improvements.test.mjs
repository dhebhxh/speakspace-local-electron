import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const screenPath = new URL("../src/app/ask-ai.tsx", import.meta.url);
const inferencePath = new URL("../src/services/llm-inference-service.ts", import.meta.url);
const evidencePath = new URL("../src/services/ask-ai-evidence-gate.ts", import.meta.url);
const configPath = new URL("../src/constants/ask-ai-inference-config.ts", import.meta.url);

test("Ask AI restores the most recently persisted conversation unless New was requested", async () => {
  const source = await readFile(screenPath, "utf8");
  assert.match(source, /routeStartsNewConversation/);
  assert.match(source, /getConversationHistory\(\)/);
  assert.match(source, /\.at\(0\)\?\.conversation\.getId\(\)/);
  assert.match(source, /params: \{ newConversation: "1" \}/);
  assert.match(source, /getCanonicalMessages\(conversationIdToLoad\)/);
});

test("Ask AI exposes visible generation stages instead of an empty spinner", async () => {
  const source = await readFile(screenPath, "utf8");
  assert.match(source, /onStatus: setGenerationStage/);
  assert.match(source, /Finding the relevant note passages/);
  assert.match(source, /Checking the answer against the note/);
});

test("Ask AI skips redundant classification for a strong grounded topic match", async () => {
  const source = await readFile(evidencePath, "utf8");
  assert.match(source, /\| "topic-match"/);
  assert.match(source, /selectedEvidenceCandidates\[0\]\?\.score \?\? 0\) >= 5/);
  assert.match(source, /countCrossLanguageTopicMatches/);
  assert.match(source, /所選筆記的轉錄內容沒有足夠資訊/);
  assert.match(source, /什麼時候\|什么时候/);
});

test("Ask AI uses bounded answer and classifier budgets", async () => {
  const config = await readFile(configPath, "utf8");
  const inference = await readFile(inferencePath, "utf8");
  assert.match(config, /ASK_AI_GENERATION_RESERVE = 320/);
  assert.match(config, /ASK_AI_CLASSIFIER_TOKENS = 48/);
  assert.match(config, /ASK_AI_COMPLETION_TIMEOUT_MS = 90_000/);
  assert.match(inference, /n_predict: ASK_AI_CLASSIFIER_TOKENS/);
  assert.match(inference, /getGroundingRefusal\(currentQuestion\)/);
  assert.match(inference, /buildDirectGroundedEvidenceAnswer/);
  assert.match(inference, /new Set\(classifiedDecisions\.flatMap/);
  assert.match(inference, /stopCompletionSafely/);
  assert.doesNotMatch(inference, /stopCompletion\(\)\.catch/);
});
