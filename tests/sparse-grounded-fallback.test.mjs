import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseSparseGroundedFallback } from "../src/services/sparse-grounded-fallback.ts";

test("short factual transcripts avoid unnecessary local LLM work", () => {
  assert.equal(shouldUseSparseGroundedFallback("What's that Joe yes?"), true);
  assert.equal(shouldUseSparseGroundedFallback("產品已經完成測試"), true);
});

test("intent, time, and substantive transcripts still use structured inference", () => {
  assert.equal(shouldUseSparseGroundedFallback("Remind me about the meeting tomorrow"), false);
  assert.equal(shouldUseSparseGroundedFallback("明天記得參加會議"), false);
  assert.equal(shouldUseSparseGroundedFallback("這是一段沒有空格但是內容明顯已經超過極短筆記門檻的中文逐字稿"), false);
});
