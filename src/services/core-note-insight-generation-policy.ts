export type StructuredCompletionSignals = {
  truncated?: boolean;
  stopped_limit?: number;
  stopped_eos?: boolean;
  context_full?: boolean;
  tokens_predicted?: number;
};

export type StructuredStageResult = {
  raw: string;
  hitOutputLimit: boolean;
};

export type AdaptiveCompletionMode = "normal" | "expanded";

type UnknownItem = Record<string, unknown>;

export type SanitizedIntentOutput = {
  tasks: UnknownItem[];
  reminders: UnknownItem[];
  calendarIntents: UnknownItem[];
};

export type AdaptiveBatchResult<T> = {
  values: { input: string; value: T }[];
  failures: { input: string; reason: "invalid-json" | "output-limit" }[];
};

const MAX_INTENT_CLAUSES_PER_CHUNK = 6;
const MAX_INTENT_CHARS_PER_CHUNK = 1_100;
const MAX_RECOVERY_DEPTH = 8;
const MIN_RECOVERY_SPLIT_CHARACTERS = 240;
const MAX_FALLBACK_SUMMARY_CHARS = 800;
const MAX_FALLBACK_KEY_POINTS = 8;
const MAX_FALLBACK_KEY_POINT_CHARS = 240;

const object = (value: unknown): value is UnknownItem =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const items = (value: unknown): UnknownItem[] =>
  Array.isArray(value) ? value.filter(object) : [];

const normalized = (value: string): string =>
  value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

const truncateCharacters = (value: string, limit: number): string => {
  const characters = Array.from(value.trim());
  if (characters.length <= limit) return characters.join("");
  return `${characters.slice(0, Math.max(1, limit - 1)).join("").trimEnd()}…`;
};

export function extractFirstJsonObject(raw: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (start < 0) {
      if (character !== "{") continue;
      start = index;
      depth = 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }

  return null;
}

export function completionHitOutputLimit(
  result: StructuredCompletionSignals,
  nPredict: number,
): boolean {
  if (result.truncated || result.context_full) return true;
  if (typeof result.stopped_limit === "number" && result.stopped_limit > 0) return true;
  return (
    typeof result.tokens_predicted === "number" &&
    result.tokens_predicted >= nPredict &&
    result.stopped_eos !== true
  );
}

function segmentClauses(value: string): string[] {
  const text = value.replace(/\r\n?/gu, "\n").trim();
  if (!text) return [];
  return (
    text.match(/[^.!?。！？;；\n]+(?:[.!?。！？;；]+|$)/gu) ?? [text]
  ).map((part) => part.trim()).filter(Boolean);
}

function splitOversizedClause(value: string, maxCharacters: number): string[] {
  if (Array.from(value).length <= maxCharacters) return [value.trim()];
  const words = value.trim().split(/\s+/u);
  if (words.length > 1) {
    const parts: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (Array.from(candidate).length > maxCharacters && current) {
        parts.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) parts.push(current);
    if (parts.length > 1) return parts;
  }

  const characters = Array.from(value.trim());
  const parts: string[] = [];
  for (let start = 0; start < characters.length; start += maxCharacters) {
    parts.push(characters.slice(start, start + maxCharacters).join("").trim());
  }
  return parts.filter(Boolean);
}

function intentClauses(value: string): string[] {
  return segmentClauses(value).flatMap((clause) =>
    splitOversizedClause(clause, MAX_INTENT_CHARS_PER_CHUNK),
  );
}

export function splitIntentTranscript(value: string): string[] {
  const clauses = intentClauses(value);
  if (!clauses.length) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentCharacters = 0;
  for (const clause of clauses) {
    const clauseCharacters = Array.from(clause).length;
    const separatorCharacters = current.length ? 1 : 0;
    const wouldOverflow =
      current.length >= MAX_INTENT_CLAUSES_PER_CHUNK ||
      currentCharacters + separatorCharacters + clauseCharacters > MAX_INTENT_CHARS_PER_CHUNK;
    if (wouldOverflow && current.length) {
      chunks.push(current.join(" "));
      current = [];
      currentCharacters = 0;
    }
    current.push(clause);
    currentCharacters += (current.length > 1 ? 1 : 0) + clauseCharacters;
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

function bisectIntentInput(value: string): string[] {
  const clauses = intentClauses(value);
  if (clauses.length > 1) {
    const middle = Math.ceil(clauses.length / 2);
    return [clauses.slice(0, middle).join(" "), clauses.slice(middle).join(" ")]
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const characters = Array.from(value.trim());
  if (characters.length <= MIN_RECOVERY_SPLIT_CHARACTERS) return [value.trim()].filter(Boolean);
  const middle = Math.floor(characters.length / 2);
  const searchStart = Math.max(1, middle - Math.floor(characters.length / 4));
  const searchEnd = Math.min(characters.length - 1, middle + Math.floor(characters.length / 4));
  let splitAt = -1;
  for (let distance = 0; distance <= searchEnd - searchStart; distance += 1) {
    for (const candidate of [middle - distance, middle + distance]) {
      if (candidate < searchStart || candidate > searchEnd) continue;
      if (/\s|[,，:：]/u.test(characters[candidate] ?? "")) {
        splitAt = candidate + 1;
        break;
      }
    }
    if (splitAt > 0) break;
  }
  if (splitAt < 1 || splitAt >= characters.length) return [value.trim()];
  return [characters.slice(0, splitAt).join(""), characters.slice(splitAt).join("")]
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function runAdaptiveStructuredBatches<T>(options: {
  inputs: string[];
  complete: (input: string, mode: AdaptiveCompletionMode) => Promise<StructuredStageResult>;
  parse: (raw: string) => T;
}): Promise<AdaptiveBatchResult<T>> {
  const values: AdaptiveBatchResult<T>["values"] = [];
  const failures: AdaptiveBatchResult<T>["failures"] = [];

  const run = async (input: string, depth: number): Promise<void> => {
    const normal = await options.complete(input, "normal");
    let normalInvalid = false;
    if (!normal.hitOutputLimit) {
      try {
        values.push({ input, value: options.parse(normal.raw) });
        return;
      } catch {
        normalInvalid = true;
      }
    }

    if (normalInvalid) {
      const expanded = await options.complete(input, "expanded");
      if (!expanded.hitOutputLimit) {
        try {
          values.push({ input, value: options.parse(expanded.raw) });
          return;
        } catch {
          // Split below. A smaller evidence window is the final structured retry.
        }
      }
    }

    const parts = depth < MAX_RECOVERY_DEPTH ? bisectIntentInput(input) : [input];
    if (parts.length > 1 && parts.every((part) => part !== input)) {
      for (const part of parts) await run(part, depth + 1);
      return;
    }

    if (!normalInvalid) {
      const expanded = await options.complete(input, "expanded");
      if (!expanded.hitOutputLimit) {
        try {
          values.push({ input, value: options.parse(expanded.raw) });
          return;
        } catch {
          failures.push({ input, reason: "invalid-json" });
          return;
        }
      }
    }
    failures.push({ input, reason: normal.hitOutputLimit ? "output-limit" : "invalid-json" });
  };

  for (const input of options.inputs.map((part) => part.trim()).filter(Boolean)) {
    await run(input, 0);
  }
  return { values, failures };
}

function searchableTokens(value: string): string[] {
  return Array.from(
    new Set(
      (value.toLocaleLowerCase().match(/[a-z0-9]+|\p{Script=Han}/gu) ?? [])
        .filter((token) => token.length >= 3 || /\p{Script=Han}/u.test(token)),
    ),
  );
}

function supportingClause(item: UnknownItem, transcript: string): string {
  const clauses = segmentClauses(transcript);
  if (!clauses.length) return "";
  const evidence = [
    item.title,
    item.description,
    item.startsAtExpression,
    item.dueAtExpression,
    item.endsAtExpression,
    item.remindAtExpression,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const tokens = searchableTokens(evidence.join(" "));
  let best = "";
  let bestScore = 0;
  for (const clause of clauses) {
    const normalizedClause = normalized(clause);
    const tokenScore = tokens.reduce(
      (score, token) => score + (normalizedClause.includes(normalized(token)) ? 1 : 0),
      0,
    );
    const exactScore = evidence.reduce(
      (score, value) => score + (normalizedClause.includes(normalized(value)) ? 4 : 0),
      0,
    );
    const score = tokenScore + exactScore;
    if (score > bestScore) {
      best = clause;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : "";
}

const COMPLETED_FACT_EN = /\b(?:planned|reviewed|designed|prepared|tested|checked|verified|measured|finished|completed|submitted|delivered|created|updated|fixed|implemented|built|contacted|confirmed)\b/iu;
const COMPLETED_FACT_ZH = /(?:已经|已|完成了|测试了|检查了|审核了|准备了|设计了|开发了|提交了|验证了|测量了)/u;
const TASK_EN = /\b(?:must|needs?\s+to|has\s+to|have\s+to|should|shall|responsible\s+for|assigned\s+to|please|to-?do|action\s+item|due\s+(?:by|on)|deadline|will\s+(?:finish|complete|prepare|submit|deliver|review|test|check|send|call|write|create|update|fix|implement|build|contact|confirm))\b/iu;
const TASK_ZH = /(?:必须|需要|需在|应该|应当|负责|请|务必|待办|任务|截止|前完成|要在|将负责)/u;
const REMINDER_EN = /\b(?:remind(?:er|\s+me|\s+us)?|remember\s+to|notify|alert)\b/iu;
const REMINDER_ZH = /(?:提醒|记得|通知|闹钟)/u;
const STRONG_CALENDAR_EN = /\b(?:will\s+meet|will\s+be\s+held|is\s+scheduled|are\s+scheduled|takes?\s+place|starts?\s+at|ends?\s+at|booked\s+for|reserved\s+for)\b/iu;
const STRONG_CALENDAR_ZH = /(?:将于.{0,48}(?:进行|举行|召开|演示|答辩)|安排在|定于|预定于|预约在|举行时间|开始时间|结束时间)/u;
const EVENT_EN = /\b(?:meeting|appointment|event|conference|demonstration|demo|presentation|interview|ceremony|workshop|class|session|webinar|reservation)\b/iu;
const EVENT_ZH = /(?:会议|开会|会面|约会|活动|演示|答辩|采访|仪式|讲座|课程|研讨会|电话会议|日程|预约|预定)/u;
const TEMPORAL_EN = /\b(?:today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}:\d{2}|\d{4})\b/iu;
const TEMPORAL_ZH = /(?:今天|明天|今晚|上午|下午|晚上|星期[一二三四五六日天]|周[一二三四五六日天]|\d{1,4}\s*年|\d{1,2}\s*月|\d{1,2}\s*[日号点时])/u;
const CLOCK_EN = /\b(?:1[0-2]|0?\d)(?::[0-5]\d)?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/iu;
const CLOCK_ZH = /(?:上午|早上|中午|下午|晚上)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*[点时]/u;
const NEGATED_INTENT_EN = /\b(?:no\s+(?:task|action|reminder|meeting|event|appointment)|do\s+not\s+remind|not\s+scheduled|was\s+cancelled|is\s+cancelled)\b/iu;
const NEGATED_INTENT_ZH = /(?:无需|不需要|不要|没有)(?:.{0,8})(?:任务|待办|提醒|会议|活动|日程|预约)|(?:会议|活动|日程|预约)(?:已)?取消/u;

function completedFact(clause: string): boolean {
  return COMPLETED_FACT_EN.test(clause) || COMPLETED_FACT_ZH.test(clause);
}

function hasTaskEvidence(clause: string): boolean {
  return Boolean(clause) && !completedFact(clause) && (TASK_EN.test(clause) || TASK_ZH.test(clause));
}

function hasReminderEvidence(clause: string): boolean {
  return Boolean(clause) && (REMINDER_EN.test(clause) || REMINDER_ZH.test(clause));
}

function hasCalendarEvidence(clause: string): boolean {
  if (!clause) return false;
  if (STRONG_CALENDAR_EN.test(clause) || STRONG_CALENDAR_ZH.test(clause)) return true;
  if (completedFact(clause)) return false;
  const event = EVENT_EN.test(clause) || EVENT_ZH.test(clause);
  const temporal = TEMPORAL_EN.test(clause) || TEMPORAL_ZH.test(clause);
  return event && temporal;
}

function hasStrongCalendarEvidence(clause: string): boolean {
  return STRONG_CALENDAR_EN.test(clause) || STRONG_CALENDAR_ZH.test(clause);
}

function isNegatedIntent(clause: string): boolean {
  return NEGATED_INTENT_EN.test(clause) || NEGATED_INTENT_ZH.test(clause);
}

function cleanEvidenceTitle(clause: string): string {
  return truncateCharacters(clause.replace(/[.!?。！？;；]+$/u, "").trim(), 240);
}

function hasTemporalEvidence(clause: string): boolean {
  return TEMPORAL_EN.test(clause) || TEMPORAL_ZH.test(clause);
}

function hasClockEvidence(clause: string): boolean {
  return CLOCK_EN.test(clause) || CLOCK_ZH.test(clause);
}

function explicitEvidenceCategory(
  clause: string,
): keyof SanitizedIntentOutput | null {
  if (!clause || completedFact(clause) || isNegatedIntent(clause)) return null;
  if (hasReminderEvidence(clause)) return "reminders";
  if (hasStrongCalendarEvidence(clause)) return "calendarIntents";
  if (hasTaskEvidence(clause)) return "tasks";
  if (hasCalendarEvidence(clause)) return "calendarIntents";
  return null;
}

function deterministicIntentItem(
  clause: string,
  category: keyof SanitizedIntentOutput,
): UnknownItem {
  const title = cleanEvidenceTitle(clause);
  if (category === "tasks") {
    return {
      title,
      description: null,
      startsAtExpression: null,
      dueAtExpression: hasTemporalEvidence(clause) ? clause : null,
      actionItems: [],
    };
  }
  if (category === "reminders") {
    return {
      title,
      description: null,
      remindAtExpression: hasTemporalEvidence(clause) ? clause : null,
    };
  }
  return {
    title,
    description: null,
    startsAtExpression: hasTemporalEvidence(clause) ? clause : null,
    endsAtExpression: null,
    allDay: !hasClockEvidence(clause),
    timezone: null,
  };
}

function addMissingExplicitEvidence(
  output: SanitizedIntentOutput,
  transcript: string,
): SanitizedIntentOutput {
  const represented = {
    tasks: new Set(output.tasks.map((item) => normalized(supportingClause(item, transcript))).filter(Boolean)),
    reminders: new Set(output.reminders.map((item) => normalized(supportingClause(item, transcript))).filter(Boolean)),
    calendarIntents: new Set(output.calendarIntents.map((item) => normalized(supportingClause(item, transcript))).filter(Boolean)),
  };
  for (const clause of segmentClauses(transcript)) {
    const category = explicitEvidenceCategory(clause);
    if (!category) continue;
    const identity = normalized(clause);
    if (represented[category].has(identity)) continue;
    output[category].push(deterministicIntentItem(clause, category));
    represented[category].add(identity);
  }
  return output;
}

function groundedExpression(value: unknown, clause: string): string | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  return normalized(clause).includes(normalized(value)) ? value.trim() : null;
}

function groundedItem(item: UnknownItem, clause: string): UnknownItem {
  return {
    ...item,
    startsAtExpression: groundedExpression(item.startsAtExpression, clause),
    dueAtExpression: groundedExpression(item.dueAtExpression, clause),
    endsAtExpression: groundedExpression(item.endsAtExpression, clause),
    remindAtExpression: groundedExpression(item.remindAtExpression, clause),
  };
}

export function sanitizeIntentOutput(value: unknown, transcript: string): SanitizedIntentOutput {
  const output = object(value) ? value : {};
  const tasks = items(output.tasks).flatMap((item) => {
    const clause = supportingClause(item, transcript);
    if (!hasTaskEvidence(clause) || isNegatedIntent(clause)) return [];
    const actionItems = items(item.actionItems).flatMap((action) => {
      const actionClause = supportingClause(action, transcript);
      return hasTaskEvidence(actionClause) ? [groundedItem(action, actionClause)] : [];
    });
    return [{ ...groundedItem(item, clause), actionItems }];
  });
  const reminders = items(output.reminders).flatMap((item) => {
    const clause = supportingClause(item, transcript);
    return hasReminderEvidence(clause) && !isNegatedIntent(clause) ? [groundedItem(item, clause)] : [];
  });
  const calendarIntents = items(output.calendarIntents).flatMap((item) => {
    const clause = supportingClause(item, transcript);
    return hasCalendarEvidence(clause) && !isNegatedIntent(clause) ? [groundedItem(item, clause)] : [];
  });
  return addMissingExplicitEvidence({ tasks, reminders, calendarIntents }, transcript);
}

function itemIdentity(item: UnknownItem): string {
  return [
    item.title,
    item.startsAtExpression,
    item.dueAtExpression,
    item.remindAtExpression,
  ].map((value) => normalized(typeof value === "string" ? value : "")).join("|");
}

function uniqueItems(values: UnknownItem[]): UnknownItem[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const identity = itemIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function mergeIntentOutputs(values: SanitizedIntentOutput[]): SanitizedIntentOutput {
  return {
    tasks: uniqueItems(values.flatMap((value) => value.tasks)),
    reminders: uniqueItems(values.flatMap((value) => value.reminders)),
    calendarIntents: uniqueItems(values.flatMap((value) => value.calendarIntents)),
  };
}

export function sanitizeAdaptiveIntentBatches(
  batches: AdaptiveBatchResult<unknown>,
): SanitizedIntentOutput {
  return mergeIntentOutputs([
    ...batches.values.map(({ input, value }) => sanitizeIntentOutput(value, input)),
    ...batches.failures.map(({ input }) => sanitizeIntentOutput({}, input)),
  ]);
}

export function fallbackContentFromTranscript(transcript: string): {
  summary: string;
  keyPoints: string[];
} {
  const compact = transcript.replace(/\s+/gu, " ").trim();
  const clauses = segmentClauses(transcript);
  return {
    summary: truncateCharacters(compact, MAX_FALLBACK_SUMMARY_CHARS),
    keyPoints: clauses
      .slice(0, MAX_FALLBACK_KEY_POINTS)
      .map((clause) => truncateCharacters(clause, MAX_FALLBACK_KEY_POINT_CHARS))
      .filter(Boolean),
  };
}
