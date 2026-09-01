import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  completionHitOutputLimit,
  extractFirstJsonObject,
  fallbackContentFromTranscript,
  mergeIntentOutputs,
  runAdaptiveStructuredBatches,
  sanitizeAdaptiveIntentBatches,
  sanitizeIntentOutput,
  splitIntentTranscript,
} from "../src/services/core-note-insight-generation-policy.ts";
import { extractCoreNoteTimeExpression, resolveCoreNoteTime } from "../src/services/core-note-time.ts";
import { annotateTaskRecurrences } from "../src/services/task-recurrence.ts";

const emptyIntents = () => ({ tasks: [], reminders: [], calendarIntents: [] });
const parseExtractedJson = (raw) => {
  const json = extractFirstJsonObject(raw);
  if (!json) throw new Error("No complete JSON object");
  return JSON.parse(json);
};

test("complete JSON is extracted through chat-template noise without accepting truncated JSON", () => {
  const complete = '<|im_start|>assistant\n{"summary":"A brace: } and quote: \\\"","keyPoints":[]}\n<|im_end|>';
  assert.equal(
    extractFirstJsonObject(complete),
    '{"summary":"A brace: } and quote: \\\"","keyPoints":[]}',
  );
  assert.equal(
    extractFirstJsonObject('<|im_start|>assistant\n{"calendarIntents":[{"title":"On 10'),
    null,
  );
});

test("native completion stop metadata detects every output-limit signal", () => {
  assert.equal(completionHitOutputLimit({ stopped_limit: 1 }, 1152), true);
  assert.equal(completionHitOutputLimit({ truncated: true }, 1152), true);
  assert.equal(completionHitOutputLimit({ context_full: true }, 1152), true);
  assert.equal(
    completionHitOutputLimit({ tokens_predicted: 1152, stopped_eos: false }, 1152),
    true,
  );
  assert.equal(
    completionHitOutputLimit({ tokens_predicted: 221, stopped_eos: true }, 1152),
    false,
  );
});

test("dense intent evidence is proactively split without losing any dated clause", () => {
  const dense = Array.from(
    { length: 16 },
    (_, index) => `On ${index + 1} September 2026, Person ${index + 1} reviewed item ${index + 1}.`,
  ).join(" ");
  const chunks = splitIntentTranscript(dense);

  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => (chunk.match(/September 2026/gu) ?? []).length <= 6));
  for (let day = 1; day <= 16; day += 1) {
    assert.ok(chunks.some((chunk) => chunk.includes(`On ${day} September 2026`)));
  }
});

test("adaptive batches split token-limited output and retry malformed minimal output", async () => {
  const calls = [];
  const result = await runAdaptiveStructuredBatches({
    inputs: ["First clause. Second clause."],
    complete: async (input, mode) => {
      calls.push([input, mode]);
      if (input === "First clause. Second clause.") {
        return { raw: '{"tasks":[', hitOutputLimit: true };
      }
      if (input === "First clause." && mode === "normal") {
        return { raw: "not-json", hitOutputLimit: false };
      }
      return {
        raw: `<|im_start|>assistant\n${JSON.stringify({ ...emptyIntents(), tasks: [{ title: input }] })}`,
        hitOutputLimit: false,
      };
    },
    parse: parseExtractedJson,
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(
    result.values.map(({ value }) => value.tasks[0].title),
    ["First clause.", "Second clause."],
  );
  assert.ok(calls.some(([input, mode]) => input === "First clause." && mode === "expanded"));
});

test("an unrecoverable minimal batch is isolated instead of failing the whole insight", async () => {
  const result = await runAdaptiveStructuredBatches({
    inputs: ["One malformed clause."],
    complete: async () => ({ raw: '{"tasks":[', hitOutputLimit: true }),
    parse: parseExtractedJson,
  });

  assert.deepEqual(result.values, []);
  assert.deepEqual(result.failures, [
    { input: "One malformed clause.", reason: "output-limit" },
  ]);
});

test("explicit evidence still survives when its minimal model batch never returns JSON", () => {
  const recovered = sanitizeAdaptiveIntentBatches({
    values: [],
    failures: [{
      input: "Leo must submit the final report by 28 August 2026.",
      reason: "output-limit",
    }],
  });

  assert.equal(recovered.tasks.length, 1);
  assert.match(recovered.tasks[0].title, /Leo/u);
});

test("completed dated facts are not promoted to tasks or calendar events", () => {
  const transcript = [
    "On 1 September 2026, Alice planned the research.",
    "On 2 September 2026, Bob reviewed the requirements.",
    "On 3 September 2026, Carol designed the interface.",
    "On 4 September 2026, David prepared the database.",
  ].join(" ");
  const modelOutput = {
    tasks: [{ title: "Alice planned the research", dueAtExpression: "On 1 September 2026" }],
    reminders: [],
    calendarIntents: [
      { title: "Bob reviewed the requirements", startsAtExpression: "On 2 September 2026" },
      { title: "Carol designed the interface", startsAtExpression: "On 3 September 2026" },
      { title: "David prepared the database", startsAtExpression: "On 4 September 2026" },
    ],
  };

  assert.deepEqual(sanitizeIntentOutput(modelOutput, transcript), emptyIntents());
});

test("explicit English and Chinese tasks, reminders, and events remain available", () => {
  const english = [
    "Leo Wong must finish the offline-search benchmark by 28 August 2026.",
    "The team will meet in Lab 3 at 14:30 on 26 August 2026.",
    "Maya asked for a reminder at 13:45 on the same day.",
  ].join(" ");
  const englishOutput = {
    tasks: [{ title: "Leo Wong must finish the offline-search benchmark", dueAtExpression: "28 August 2026", actionItems: [] }],
    reminders: [{ title: "Remind Maya", description: "Maya asked for a reminder", remindAtExpression: "13:45 on the same day" }],
    calendarIntents: [{ title: "Team meeting", description: "The team will meet in Lab 3", startsAtExpression: "14:30 on 26 August 2026" }],
  };
  const keptEnglish = sanitizeIntentOutput(englishOutput, english);
  assert.equal(keptEnglish.tasks.length, 1);
  assert.equal(keptEnglish.reminders.length, 1);
  assert.equal(keptEnglish.calendarIntents.length, 1);

  const chinese = "启航小组将在 2026 年 8 月 30 日下午 3 点于图书馆二楼进行毕业设计演示。林悦负责 iOS 客户端演示，周凯需要在 8 月 27 日前完成离线搜索测试。请在演示开始前一小时提醒林悦检查投影设备。";
  const chineseOutput = {
    tasks: [{ title: "周凯完成离线搜索测试", dueAtExpression: "8 月 27 日前", actionItems: [] }],
    reminders: [{ title: "提醒林悦检查投影设备", remindAtExpression: "演示开始前一小时" }],
    calendarIntents: [{ title: "毕业设计演示", startsAtExpression: "2026 年 8 月 30 日下午 3 点" }],
  };
  const keptChinese = sanitizeIntentOutput(chineseOutput, chinese);
  assert.equal(keptChinese.tasks.length, 1);
  assert.equal(keptChinese.reminders.length, 1);
  assert.equal(keptChinese.calendarIntents.length, 1);
});

test("high-confidence explicit intents are recovered when the small model returns empty arrays", () => {
  const transcript = [
    "Leo Wong must finish the offline-search benchmark by 28 August 2026.",
    "The team will meet in Lab 3 at 14:30 on 26 August 2026.",
    "Maya asked for a reminder at 13:45 on the same day.",
  ].join(" ");

  const recovered = sanitizeIntentOutput(emptyIntents(), transcript);
  assert.equal(recovered.tasks.length, 1);
  assert.match(recovered.tasks[0].title, /Leo Wong/u);
  assert.equal(recovered.reminders.length, 1);
  assert.match(recovered.reminders[0].title, /Maya/u);
  assert.equal(recovered.calendarIntents.length, 1);
  assert.match(recovered.calendarIntents[0].title, /Lab 3/u);
});

test("explicit recurring actions survive when the small model omits them", () => {
  const reference = new Date("2026-08-24T08:00:00+01:00");
  const transcript = annotateTaskRecurrences(
    "Every Monday at 9 AM send the project status report. Every weekday review bug reports.",
    reference,
  );
  const recovered = sanitizeIntentOutput(emptyIntents(), transcript);

  assert.equal(recovered.tasks.length, 2);
  assert.equal(recovered.tasks[0].recurrence, "weekly");
  assert.match(recovered.tasks[0].dueAtExpression, /^2026-08-31 9 AM$/u);
  assert.match(resolveCoreNoteTime(recovered.tasks[0].dueAtExpression, reference)?.normalized ?? "", /^2026-08-31T09:00:00/u);
  assert.equal(recovered.tasks[1].recurrence, "weekdays");
  assert.equal(recovered.tasks[1].dueAtExpression, "2026-08-24");
});

test("negated intents are not recreated by deterministic coverage", () => {
  const transcript = "No reminder is required. The meeting was cancelled.";
  assert.deepEqual(sanitizeIntentOutput(emptyIntents(), transcript), emptyIntents());
});

test("polluted time fields are reduced to grounded time phrases for every intent kind", () => {
  const transcript = [
    "Please submit them before next Thursday.",
    "Remember to call Maya at 13:45 on the same day.",
    "The review meeting will be held at 14:30 on 3 September 2026.",
  ].join(" ");
  const sanitized = sanitizeIntentOutput({
    tasks: [{ title: "Submit them", dueAtExpression: "Please submit them before next Thursday", actionItems: [] }],
    reminders: [{ title: "Call Maya", remindAtExpression: "Remember to call Maya at 13:45 on the same day" }],
    calendarIntents: [{ title: "Review meeting", startsAtExpression: "The review meeting will be held at 14:30 on 3 September 2026" }],
  }, transcript);

  assert.equal(sanitized.tasks[0].dueAtExpression, "before next Thursday");
  assert.equal(sanitized.reminders[0].remindAtExpression, "at 13:45 on the same day");
  assert.equal(sanitized.calendarIntents[0].startsAtExpression, "at 14:30 on 3 September 2026");
  assert.equal(extractCoreNoteTimeExpression("This has no date"), null);

  const recovered = sanitizeIntentOutput(emptyIntents(), transcript);
  assert.equal(recovered.tasks[0].dueAtExpression, "before next Thursday");
  assert.equal(recovered.reminders[0].remindAtExpression, "at 13:45 on the same day");
  assert.equal(recovered.calendarIntents[0].startsAtExpression, "at 14:30 on 3 September 2026");
});

test("negated and advisory task clauses are rejected even when the model emits tasks", () => {
  const transcript = [
    "You do not need to memorize these definitions by Friday.",
    "I'd recommend starting the optional reading next Thursday.",
  ].join(" ");
  const modelOutput = {
    ...emptyIntents(),
    tasks: [
      { title: "Memorize these definitions", dueAtExpression: "by Friday", actionItems: [] },
      { title: "Start the optional reading", dueAtExpression: "next Thursday", actionItems: [] },
    ],
  };

  assert.deepEqual(sanitizeIntentOutput(modelOutput, transcript), emptyIntents());
});

test("English date and time evidence in a full grounded clause resolves locally", () => {
  const reference = new Date("2026-08-24T10:00:00+01:00");
  assert.equal(
    resolveCoreNoteTime("Leo must finish by 28 August 2026.", reference)?.normalized,
    "2026-08-28",
  );
  assert.match(
    resolveCoreNoteTime("The team will meet at 14:30 on 26 August 2026.", reference)?.normalized ?? "",
    /^2026-08-26T14:30:00/u,
  );
});

test("many genuine events survive batching and merge without an arbitrary item cap", () => {
  const transcript = Array.from(
    { length: 16 },
    (_, index) => `Meeting ${index + 1} will be held on ${index + 1} September 2026.`,
  ).join(" ");
  const sanitizedBatches = splitIntentTranscript(transcript).map((chunk) => {
    const calendarIntents = Array.from(chunk.matchAll(/Meeting (\d+) will be held on (\d+ September 2026)\./gu))
      .map((match) => ({ title: `Meeting ${match[1]}`, startsAtExpression: match[2] }));
    return sanitizeIntentOutput({ ...emptyIntents(), calendarIntents }, chunk);
  });

  const merged = mergeIntentOutputs(sanitizedBatches);
  assert.equal(merged.calendarIntents.length, 16);
});

test("merged intent batches deduplicate repeated boundary results", () => {
  const repeated = {
    tasks: [{ title: "Submit report", dueAtExpression: "Friday", actionItems: [] }],
    reminders: [],
    calendarIntents: [],
  };
  const merged = mergeIntentOutputs([repeated, repeated, emptyIntents()]);
  assert.equal(merged.tasks.length, 1);
});

test("content fallback remains useful and bounded when a model never closes JSON", () => {
  const transcript = Array.from({ length: 20 }, (_, index) => `Fact ${index + 1} is recorded.`).join(" ");
  const fallback = fallbackContentFromTranscript(transcript);
  assert.ok(fallback.summary.length > 0);
  assert.ok(fallback.summary.length <= 800);
  assert.ok(fallback.keyPoints.length > 0);
  assert.ok(fallback.keyPoints.length <= 8);
});

test("CoreNoteInsightService defaults to one structured completion and keeps adaptive generation as fallback", async () => {
  const service = await readFile(
    new URL("../src/services/core-note-insight-service.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /runAdaptiveStructuredBatches/);
  assert.match(service, /structuredSchema/);
  assert.match(service, /generateStructured/);
  assert.match(service, /Single-stage pipeline completed/);
  assert.match(service, /Falling back to content and batched intents/);
  assert.match(service, /promptTokens > maxPrompt/);
  assert.match(service, /completionHitOutputLimit/);
  assert.match(service, /splitIntentTranscript/);
  assert.match(service, /sanitizeAdaptiveIntentBatches/);
  assert.match(service, /hitOutputLimit/);
  assert.match(service, /stoppedLimit/);
});

test("Structured Note streaming only builds changed previews after throttling", async () => {
  const service = await readFile(
    new URL("../src/services/core-note-insight-service.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /publishStreamingPreview/);
  assert.match(service, /sameCoreInsightPreview/);
  assert.match(service, /previousStatus !== state\.status/);
  assert.match(service, /< 100/);
  assert.doesNotMatch(service, /publishPartial/);
});

test("single-stage schema preserves the stable task and calendar candidate contract", async () => {
  const service = await readFile(
    new URL("../src/services/core-note-insight-service.ts", import.meta.url),
    "utf8",
  );

  for (const field of [
    "summary", "keyPoints", "tasks", "actionItems", "recurrence",
    "reminders", "calendarIntents", "description", "startsAtExpression",
    "dueAtExpression", "remindAtExpression", "endsAtExpression", "allDay", "timezone",
  ]) assert.match(service, new RegExp(field));
  assert.match(service, /status: "pending"/);
  assert.match(service, /completedAt: null/);
  assert.match(service, /resolveCoreNoteTime\(item\.startsAtExpression/);
  assert.match(service, /resolveCoreNoteTime\(item\.endsAtExpression/);
  assert.match(service, /resolveCoreNoteTime\(item\.remindAtExpression/);
});

test("Structured Note key points prefer a concise selection and are schema-capped at six", async () => {
  const service = await readFile(
    new URL("../src/services/core-note-insight-service.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /Prefer 3 to 5 key points for an ordinary note/);
  assert.match(service, /Use 1 or 2 when the note contains little meaningful information/);
  assert.match(service, /Never return more than 6 key points/);
  assert.match(service, /Merge semantically related information instead of extracting sentence by sentence/);
  assert.match(service, /omitting it would materially reduce the user's understanding/);
  assert.match(service, /keyPoints: \{ type: "array", items: \{ type: "string" \}, maxItems: 6 \}/);
  assert.doesNotMatch(service, /Select at most 12 non-overlapping items/);
});
