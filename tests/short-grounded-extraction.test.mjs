import assert from "node:assert/strict";
import test from "node:test";

import { resolveCoreNoteTime } from "../src/services/core-note-time.ts";
import {
  extractDeterministicShortInsight,
  extractDeterministicShortKnowledge,
} from "../src/services/short-grounded-extraction.ts";

const chineseNote = '请记得在2026年8月28日下午3点完成专案检报。下午4点和王小明在伦敦办公室开会。专案代号是"蓝海"。';

test("short Chinese notes extract grounded tasks, reminders, and dated meetings without the LLM", () => {
  const result = extractDeterministicShortInsight(chineseNote);
  assert.ok(result);
  assert.equal(result.intents.tasks.length, 1);
  assert.equal(result.intents.reminders.length, 1);
  assert.equal(result.intents.calendarIntents.length, 1);
  assert.equal(result.intents.calendarIntents[0].startsAtExpression, "2026年8月28日 下午4点");

  const taskTime = resolveCoreNoteTime(result.intents.tasks[0].dueAtExpression, new Date("2026-08-24T12:00:00+01:00"));
  const meetingTime = resolveCoreNoteTime(result.intents.calendarIntents[0].startsAtExpression, new Date("2026-08-24T12:00:00+01:00"));
  assert.equal(taskTime?.resolvedDate, "2026-08-28");
  assert.match(taskTime?.normalized ?? "", /T15:00:00/);
  assert.equal(meetingTime?.resolvedDate, "2026-08-28");
  assert.match(meetingTime?.normalized ?? "", /T16:00:00/);
});

test("short factual content is routed into grounded General knowledge sections", () => {
  const sections = extractDeterministicShortKnowledge(
    chineseNote,
    "general",
    ["background", "details", "relationships", "perspectives", "openQuestions"],
  );
  assert.ok(sections);
  assert.deepEqual(sections.details, ['专案代号是"蓝海"']);
  assert.deepEqual(sections.openQuestions, []);
});

test("long notes continue to use model inference", () => {
  const longNote = Array.from({ length: 20 }, (_, index) => `第${index + 1}段包含需要分析的完整背景與不同細節`).join("。");
  assert.equal(extractDeterministicShortInsight(longNote), null);
});

test("yearless Traditional Chinese 號 dates separate an event from its earlier reminder", () => {
  const result = extractDeterministicShortInsight("我在8月26號有一場工作面試請在8月25號提醒我要參加這場工作面試");
  assert.ok(result);
  assert.equal(result.intents.reminders[0].remindAtExpression, "8月25號");
  assert.equal(result.intents.calendarIntents[0].startsAtExpression, "8月26號");

  const reference = new Date("2026-08-25T10:00:00+01:00");
  assert.equal(resolveCoreNoteTime(result.intents.reminders[0].remindAtExpression, reference)?.resolvedDate, "2026-08-25");
  assert.equal(resolveCoreNoteTime(result.intents.calendarIntents[0].startsAtExpression, reference)?.resolvedDate, "2026-08-26");
});
