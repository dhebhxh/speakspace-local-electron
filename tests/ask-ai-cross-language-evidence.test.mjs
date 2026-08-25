import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectGroundedEvidenceAnswer,
  countCrossLanguageTopicMatches,
} from "../src/services/ask-ai-evidence-text.ts";

test("English meeting questions match Chinese transcript evidence", () => {
  const evidence = "下午4点和王小明在伦敦办公室开会。";
  assert.equal(countCrossLanguageTopicMatches("Where is the meeting and who is it with?", evidence), 1);
  assert.equal(countCrossLanguageTopicMatches("Where is the office?", evidence), 1);
});

test("unrelated cross-language questions do not become supported", () => {
  const evidence = "专案代号是蓝海。";
  assert.equal(countCrossLanguageTopicMatches("What food was ordered?", evidence), 0);
});

test("verified short meeting evidence answers location and participant without a second model pass", () => {
  assert.equal(
    buildDirectGroundedEvidenceAnswer(
      "Where is the meeting and who is it with?",
      ["下午4点和王小明在伦敦办公室开会。"],
    ),
    "The meeting is at 伦敦办公室, with 王小明.",
  );
});
