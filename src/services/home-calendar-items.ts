import type { CoreCalendarIntent, CoreTask } from "@/domain/core-note-insight/core-note-insight";
import type { Note } from "@/domain/note/note";

export type HomeCalendarItemKind = "task" | "reminder" | "calendar";
export type HomeCalendarItem = {
  id: string;
  sourceNoteId: string;
  title: string;
  kind: HomeCalendarItemKind;
  dateKey: string;
  source: "structured" | "transcript";
};

type HomeCalendarInput = {
  notes: readonly Note[];
  tasks: readonly CoreTask[];
  calendarIntents: readonly CoreCalendarIntent[];
  reference?: Date;
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
  april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
  august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};
const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};
const CONTEXT_PATTERN = /\b(?:need|must|should|plan|submit|send|finish|complete|prepare|call|email|review|meet|meeting|remind|appointment|deadline|due|schedule|book|attend)\b|(?:任务|提醒|会议|开会|需要|必须|计划|安排|提交|发送|完成|准备|联系|复习|截止|预约)/iu;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function keyFromIso(value: string | null): string | null {
  if (!value) return null;
  const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed);
}

function validLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

function inferYear(month: number, day: number, reference: Date): number {
  const thisYear = validLocalDate(reference.getFullYear(), month, day);
  if (!thisYear) return reference.getFullYear();
  const endOfDay = new Date(thisYear);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < reference.getTime() ? reference.getFullYear() + 1 : reference.getFullYear();
}

type DateMatch = { start: number; end: number; date: Date; contextual: boolean };

function explicitDateMatches(sentence: string, reference: Date): DateMatch[] {
  const matches: DateMatch[] = [];
  const add = (match: RegExpExecArray, date: Date | null) => {
    if (date) matches.push({ start: match.index, end: match.index + match[0].length, date, contextual: false });
  };
  for (const match of sentence.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    add(match as RegExpExecArray, validLocalDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  for (const match of sentence.matchAll(/(?:(20\d{2})年)?(1[0-2]|0?[1-9])月(3[01]|[12]\d|0?[1-9])日?/g)) {
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    add(match as RegExpExecArray, validLocalDate(match[1] ? Number(match[1]) : inferYear(month, day, reference), month, day));
  }
  for (const match of sentence.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(3[01]|[12]?\d)(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/gi)) {
    const month = MONTHS[match[1].toLocaleLowerCase()];
    const day = Number(match[2]);
    add(match as RegExpExecArray, validLocalDate(match[3] ? Number(match[3]) : inferYear(month, day, reference), month, day));
  }
  for (const match of sentence.matchAll(/\b(3[01]|[12]?\d)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+(20\d{2}))?\b/gi)) {
    const month = MONTHS[match[2].toLocaleLowerCase()];
    const day = Number(match[1]);
    add(match as RegExpExecArray, validLocalDate(match[3] ? Number(match[3]) : inferYear(month, day, reference), month, day));
  }
  return matches;
}

function relativeDateMatches(sentence: string, reference: Date): DateMatch[] {
  if (!CONTEXT_PATTERN.test(sentence)) return [];
  const matches: DateMatch[] = [];
  const addDays = (match: RegExpExecArray, days: number) => {
    const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + days, 12);
    matches.push({ start: match.index, end: match.index + match[0].length, date, contextual: true });
  };
  for (const match of sentence.matchAll(/\bday after tomorrow\b|后天/giu)) addDays(match as RegExpExecArray, 2);
  for (const match of sentence.matchAll(/\btomorrow\b|明天/giu)) addDays(match as RegExpExecArray, 1);
  for (const match of sentence.matchAll(/\btoday\b|今天/giu)) addDays(match as RegExpExecArray, 0);
  for (const match of sentence.matchAll(/\b(this|next)\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/giu)) {
    const target = WEEKDAYS[match[2].toLocaleLowerCase()];
    let delta = (target - reference.getDay() + 7) % 7;
    if (match[1].toLocaleLowerCase() === "next" && delta === 0) delta = 7;
    addDays(match as RegExpExecArray, delta);
  }
  for (const match of sentence.matchAll(/(本周|这周|下周)([一二三四五六日天])/gu)) {
    const target = WEEKDAYS[match[2]];
    const currentMondayIndex = (reference.getDay() + 6) % 7;
    const targetMondayIndex = (target + 6) % 7;
    const delta = match[1] === "下周"
      ? 7 - currentMondayIndex + targetMondayIndex
      : targetMondayIndex - currentMondayIndex;
    addDays(match as RegExpExecArray, delta);
  }
  return matches;
}

function inferKind(sentence: string): HomeCalendarItemKind {
  if (/\bremind(?:er)?\b|提醒/iu.test(sentence)) return "reminder";
  if (/\bmeeting|appointment|event|schedule|book|attend\b|会议|开会|预约|活动|日程/iu.test(sentence)) return "calendar";
  return "task";
}

function fallbackTitle(sentence: string, match: DateMatch): string {
  const withoutDate = `${sentence.slice(0, match.start)} ${sentence.slice(match.end)}`
    .replace(/^[\s,，。.;；:：!?！？-]+|[\s,，。.;；:：!?！？-]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(?:is|are|was|were)\s+on\s+(?=at\b)/giu, "")
    .replace(/\b(scheduled|planned|set)\s+for\s+(?=at\b)/giu, "$1 ")
    .replace(/\b(?:is|are|was|were)\s+(?:on|at)\s*$/giu, "")
    .replace(/\b(?:on|at|by|due|for)\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();
  return (withoutDate || sentence.trim() || "Transcript date").slice(0, 140);
}

function transcriptFallbacks(note: Note, reference: Date): HomeCalendarItem[] {
  const sentences = note.getTranscript().split(/(?<=[.!?。！？；;])|\n+/u).map((value) => value.trim()).filter(Boolean);
  const items: HomeCalendarItem[] = [];
  for (const [sentenceIndex, sentence] of sentences.entries()) {
    if (/\b(?:later|next week|next month)\b|(?:以后|稍后|下周|下个月)/iu.test(sentence) && !/(下周)[一二三四五六日天]/u.test(sentence)) {
      continue;
    }
    const matches = [...explicitDateMatches(sentence, reference), ...relativeDateMatches(sentence, reference)]
      .sort((left, right) => left.start - right.start);
    const seenDates = new Set<string>();
    for (const [matchIndex, match] of matches.entries()) {
      const key = dateKey(match.date);
      if (seenDates.has(key)) continue;
      seenDates.add(key);
      items.push({
        id: `transcript-${note.getId()}-${sentenceIndex}-${matchIndex}-${key}`,
        sourceNoteId: note.getId(),
        title: fallbackTitle(sentence, match),
        kind: inferKind(sentence),
        dateKey: key,
        source: "transcript",
      });
    }
  }
  return items;
}

export function buildHomeCalendarItems({ notes, tasks, calendarIntents, reference = new Date() }: HomeCalendarInput): HomeCalendarItem[] {
  const structured: HomeCalendarItem[] = [];
  for (const task of tasks) {
    if (task.status !== "pending" || task.isCurrent === false) continue;
    const key = keyFromIso(task.dueAt);
    if (key) structured.push({ id: task.id, sourceNoteId: task.sourceNoteId, title: task.title, kind: "task", dateKey: key, source: "structured" });
  }
  for (const intent of calendarIntents) {
    if (intent.status !== "pending") continue;
    const key = keyFromIso(intent.kind === "reminder" ? (intent.remindAt ?? intent.dueAt ?? intent.startsAt) : (intent.startsAt ?? intent.dueAt));
    if (key) structured.push({ id: intent.id, sourceNoteId: intent.sourceNoteId, title: intent.title, kind: intent.kind, dateKey: key, source: "structured" });
  }
  const occupied = new Set(structured.map((item) => `${item.sourceNoteId}|${item.dateKey}`));
  const fallback = notes.flatMap((note) => transcriptFallbacks(note, reference))
    .filter((item) => !occupied.has(`${item.sourceNoteId}|${item.dateKey}`));
  return [...structured, ...fallback].sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.title.localeCompare(right.title));
}
