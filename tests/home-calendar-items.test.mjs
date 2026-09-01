import assert from "node:assert/strict";
import test from "node:test";

const { getOpenTaskNoteIds, groupHomeCalendarItems, toLocalDateKey } = await import(
  "../src/services/home-calendar-items.ts"
);

function note({ id = "note-zh", name = "XX", transcript, createdAt = "2026-08-25T10:00:00+01:00" }) {
  return {
    getId: () => id,
    getName: () => name,
    getTranscript: () => transcript,
    getCreatedAt: () => createdAt,
  };
}

test("calendar marks dated pending tasks as well as calendar intents", () => {
  const tasks = [
    { id: "task-1", title: "交報告", status: "pending", dueAt: "2026-08-29", startsAt: null, sourceNoteId: "note-1" },
    { id: "task-2", title: "已完成", status: "completed", dueAt: "2026-08-30", startsAt: null, sourceNoteId: "note-1" },
  ];
  const intents = [
    { id: "reminder-1", kind: "reminder", title: "記得開會", status: "pending", startsAt: null, dueAt: null, remindAt: "2026-08-29T09:00:00", sourceNoteId: "note-1" },
  ];

  const grouped = groupHomeCalendarItems(tasks, intents);
  assert.deepEqual(grouped.get("2026-08-29")?.map((item) => item.kind), ["task", "reminder"]);
  assert.equal(grouped.has("2026-08-30"), false);
});

test("date-only values do not shift across device timezones", () => {
  assert.equal(toLocalDateKey("2026-08-29"), "2026-08-29");
  assert.equal(toLocalDateKey("2026-08-29T18:30:00+08:00"), "2026-08-29");
});

test("calendar reads Traditional Chinese reminder and event dates directly from note content", () => {
  const grouped = groupHomeCalendarItems([], [], [note({
    transcript: "我在8月26號有一場工作面試請在8月25號提醒我要參加這場工作面試",
  })]);

  assert.deepEqual(grouped.get("2026-08-26")?.map(({ kind, title }) => ({ kind, title })), [
    { kind: "calendar", title: "工作面試" },
  ]);
  assert.deepEqual(grouped.get("2026-08-25")?.map(({ kind, title }) => ({ kind, title })), [
    { kind: "reminder", title: "參加這場工作面試" },
  ]);
  assert.deepEqual([...getOpenTaskNoteIds(grouped)], ["note-zh"]);
});

test("stored Structured Note items take precedence over note-content fallbacks", () => {
  const intents = [{
    id: "stored-reminder",
    kind: "reminder",
    title: "準備面試",
    status: "pending",
    startsAt: null,
    dueAt: null,
    remindAt: "2026-08-25",
    sourceNoteId: "note-zh",
  }];
  const grouped = groupHomeCalendarItems([], intents, [note({
    transcript: "請在8月25號提醒我準備面試",
  })]);

  assert.equal(grouped.get("2026-08-25")?.length, 1);
  assert.equal(grouped.get("2026-08-25")?.[0].id, "stored-reminder");
});

test("Open tasks counts each actionable note once across tasks and calendar items", () => {
  const tasks = [
    { id: "task-1", title: "交報告", status: "pending", dueAt: "2026-08-29", startsAt: null, sourceNoteId: "note-1" },
    { id: "task-2", title: "寄電郵", status: "pending", dueAt: "2026-08-30", startsAt: null, sourceNoteId: "note-1" },
    { id: "task-3", title: "整理資料", status: "pending", dueAt: null, startsAt: null, sourceNoteId: "note-3" },
  ];
  const grouped = groupHomeCalendarItems(tasks, [], [note({
    id: "note-2",
    transcript: "8月31號要提交報告",
  })]);

  assert.deepEqual([...getOpenTaskNoteIds(grouped, tasks)].sort(), ["note-1", "note-2", "note-3"]);
});

test("a completed stored task cannot reappear through transcript fallback", () => {
  const tasks = [{
    id: "task-complete",
    title: "交報告",
    status: "completed",
    dueAt: "2026-08-29",
    startsAt: null,
    sourceNoteId: "note-zh",
  }];
  const grouped = groupHomeCalendarItems(tasks, [], [note({
    transcript: "8月29號要提交報告",
  })]);

  assert.equal(grouped.has("2026-08-29"), false);
  assert.equal(getOpenTaskNoteIds(grouped, tasks).size, 0);
});
