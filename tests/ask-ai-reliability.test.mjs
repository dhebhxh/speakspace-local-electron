import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inferenceConfig = await import(
  "../src/constants/ask-ai-inference-config.ts"
);
const evidenceText = await import(
  "../src/services/ask-ai-evidence-text.ts"
);
const evidenceDecision = await import(
  "../src/services/ask-ai-evidence-decision.ts"
);

test("Ask AI enforces the agreed generation deadline", () => {
  assert.equal(inferenceConfig.ASK_AI_GENERATION_DEADLINE_MS, 90_000);
});

test("selected transcript evidence cannot be vetoed by a separate answerability completion", () => {
  const status = evidenceDecision.resolveSelectedEvidenceStatus(
    "selected-evidence-present",
    1,
  );

  assert.equal(status, "supported");
});

test("broad multi-note Ask AI uses balanced best-effort evidence instead of a size refusal", async () => {
  const [gate, inference] = await Promise.all([
    readFile(new URL("../src/services/ask-ai-evidence-gate.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/services/llm-inference-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(gate, /MAX_OVERVIEW_CANDIDATES = 3/);
  assert.match(gate, /balancedOverviewCandidates/);
  assert.match(gate, /evidenceCoveragePartial/);
  assert.match(inference, /extractionPrompt\.evidenceCoveragePartial/);
  assert.match(inference, /基于所选笔记的尽力概括，可能未覆盖全部细节/);
});

test("Ask AI restores the latest exact source-set conversation with an explicit new-chat escape hatch", async () => {
  const [repository, service, screen] = await Promise.all([
    readFile(new URL("../src/repositories/ai-conversation-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/services/ai-conversation-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/ask-ai.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(repository, /findLatestByExactNoteIds/);
  assert.match(service, /getResumeTargetForNotes/);
  assert.match(screen, /getResumeTargetForNotes\(selectedNotes\.map/);
  assert.match(screen, /noteIds/);
  assert.match(screen, /mode:\s*"new"/);
});

test("Ask AI generation exposes durable foreground state and stops on background", async () => {
  const [inferenceService, rootLayout] = await Promise.all([
    readFile(new URL("../src/services/llm-inference-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(inferenceService, /getGenerationSnapshot/);
  assert.match(inferenceService, /subscribeToGeneration/);
  assert.match(inferenceService, /ASK_AI_GENERATION_DEADLINE_MS/);
  assert.doesNotMatch(inferenceService, /ASK_AI_CLASSIFIER_TOKEN_LIMIT/);
  assert.doesNotMatch(inferenceService, /answerability classifier/);
  assert.match(rootLayout, /stopGenerationForBackground/);
});

test("Ask AI shows an accessible inline spinner before an answer is available", async () => {
  const screen = await readFile(
    new URL("../src/app/ask-ai.tsx", import.meta.url),
    "utf8",
  );

  assert.match(screen, /ActivityIndicator/);
  assert.match(screen, /AI is working/);
  assert.match(screen, /accessibilityLiveRegion="polite"/);
});

test("Ask AI uses a Chinese grounding refusal for a Chinese question", async () => {
  const [policy, inferenceService] = await Promise.all([
    readFile(new URL("../src/constants/ask-ai-grounding-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/services/llm-inference-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(policy, /ASK_AI_GROUNDING_REFUSAL_ZH/);
  assert.match(inferenceService, /getGroundingRefusal\(currentQuestion\)/);
});

test("Ask AI recognizes explicit responsibility and deadline facts", () => {
  const evidence = ["Alice Chen is responsible for iOS development."];

  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "Who is responsible for iOS development?",
      evidence,
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "Who is responsible for Android development?",
      evidence,
    ),
    false,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "What is the project deadline?",
      ["The team deadline is 15 September 2026."],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "What is the Android project deadline?",
      ["The team deadline is 15 September 2026."],
    ),
    false,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "谁负责 iOS 开发？",
      ["小王负责 iOS 开发。"],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "小王干什么？",
      ["小王负责 iOS 开发。"],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "小王要干什么？",
      ["小王负责 iOS 开发。"],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "项目什么时候截止？",
      ["项目截止日期是 2026 年 9 月 15 日。"],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasDirectEvidenceTokenCoverage(
      "安卓负责人是谁？",
      ["小王负责 iOS 开发。"],
    ),
    false,
  );
  assert.equal(
    evidenceText.hasUnmatchedDirectEvidenceAnchor(
      "安卓负责人是谁？",
      ["小王负责 iOS 开发。"],
    ),
    true,
  );
  assert.equal(
    evidenceText.hasUnmatchedDirectEvidenceAnchor(
      "谁负责 iOS 开发？",
      ["小王负责 iOS 开发。"],
    ),
    false,
  );
});

test("Ask AI returns same-language direct evidence without invoking the local model", async () => {
  assert.equal(
    evidenceDecision.resolveDirectEvidenceAnswer(
      "direct-evidence-match",
      "小王要干什么？",
      ["小王负责 iOS 开发。", "项目截止日期是 2026 年 9 月 15 日。"],
    ),
    "小王负责 iOS 开发。",
  );
  assert.equal(
    evidenceDecision.resolveDirectEvidenceAnswer(
      "selected-evidence-present",
      "小王要干什么？",
      ["小王负责 iOS 开发。"],
    ),
    null,
  );

  const inferenceService = await readFile(
    new URL("../src/services/llm-inference-service.ts", import.meta.url),
    "utf8",
  );
  assert.match(inferenceService, /resolveDirectEvidenceAnswer/);
});

test("Ask AI rejects a selected relation when its discriminating entity is absent", async () => {
  const gate = await readFile(
    new URL("../src/services/ask-ai-evidence-gate.ts", import.meta.url),
    "utf8",
  );

  assert.match(gate, /hasUnmatchedDirectEvidenceAnchor/);
  assert.match(
    gate,
    /hasUnmatchedDirectEvidenceAnchor\(currentQuestion, selectedEvidence\)/,
  );
});
