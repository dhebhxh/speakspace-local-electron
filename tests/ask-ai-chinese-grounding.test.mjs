import assert from "node:assert/strict";
import test from "node:test";

const evidenceText = await import(
  "../src/services/ask-ai-evidence-text.ts"
);

const REPORTED_QUESTION = "这个笔记说了什么";
const REPORTED_TRANSCRIPT =
  "8月29号我要和同学一起开个会 会的大概内容就是讨论这个项目要怎么搞";
const CHINESE_ONLY_TRANSCRIPT =
  "我要和同学一起开会讨论毕业设计项目的后续安排";

test("Chinese Ask AI text survives evidence preprocessing", () => {
  assert.notEqual(evidenceText.normalizeForSearch(REPORTED_QUESTION), "");
  assert.ok(evidenceText.tokenizeMeaningful(REPORTED_QUESTION).length > 0);
  assert.deepEqual(evidenceText.chunkTranscriptText(REPORTED_TRANSCRIPT), [
    REPORTED_TRANSCRIPT,
  ]);
  assert.deepEqual(evidenceText.chunkTranscriptText(CHINESE_ONLY_TRANSCRIPT), [
    CHINESE_ONLY_TRANSCRIPT,
  ]);
});

test("Ask AI recognizes requests for a transcript overview", () => {
  assert.equal(typeof evidenceText.isTranscriptOverviewQuestion, "function");
  assert.equal(
    evidenceText.isTranscriptOverviewQuestion(REPORTED_QUESTION),
    true,
  );
  assert.equal(
    evidenceText.isTranscriptOverviewQuestion("What did this note say?"),
    true,
  );
  assert.equal(
    evidenceText.isTranscriptOverviewQuestion("Who created this project?"),
    false,
  );
});

test("a transcript overview cannot silently drop recorded dates", () => {
  assert.deepEqual(
    evidenceText.findMissingOverviewNumberAtoms(
      REPORTED_QUESTION,
      REPORTED_TRANSCRIPT,
      "这个笔记说了讨论项目要怎么搞。",
    ),
    ["8", "29"],
  );
  assert.deepEqual(
    evidenceText.findMissingOverviewNumberAtoms(
      REPORTED_QUESTION,
      REPORTED_TRANSCRIPT,
      "8月29号要和同学开会，讨论项目要怎么搞。",
    ),
    [],
  );
  assert.deepEqual(
    evidenceText.findMissingOverviewNumberAtoms(
      "项目主题是什么？",
      REPORTED_TRANSCRIPT,
      "主题是讨论项目要怎么搞。",
    ),
    [],
  );
});
