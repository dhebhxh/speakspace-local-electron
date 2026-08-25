import type {
  CoreCalendarIntent,
  CoreTask,
} from "@/domain/core-note-insight/core-note-insight";

export type HomeCalendarItem = {
  id: string;
  kind: "task" | "reminder" | "calendar";
  title: string;
  sourceNoteId: string;
  scheduledAt: string;
};

export type HomeCalendarNoteSource = {
  getId(): string;
  getName(): string | null;
  getTranscript(): string;
  getCreatedAt(): string;
};

type NoteDateMention = {
  dateKey: string;
  end: number;
  index: number;
};

const NOTE_DATE_PATTERN = /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]/gu;
const NOTE_ISO_DATE_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/gu;
const EVENT_CONTEXT_PATTERN = /工作面試|工作面试|面試|面试|開會|开会|會議|会议|約會|约会|訪談|访谈|預約|预约|行程|活動|活动|meeting|appointment|interview|conference|call/iu;
const TASK_CONTEXT_PATTERN = /待辦|待办|任務|任务|完成|提交|準備|准备|處理|处理|聯絡|联系|回覆|回复|寄送|繳交|缴交|確認|确认|參加|参加|出席|todo|task|finish|complete|submit|prepare|attend/iu;

/**
 * Keeps date-only and local ISO values on the date written in the note.
 * Parsing YYYY-MM-DD through Date can move it to the previous day in western
 * timezones because JavaScript treats a bare date as UTC.
 */
export function toLocalDateKey(value: string | null): string | null {
  if (!value) return null;
  const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (isoDate) return isoDate;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function groupHomeCalendarItems(
  tasks: readonly CoreTask[],
  calendarIntents: readonly CoreCalendarIntent[],
  notes: readonly HomeCalendarNoteSource[] = [],
): Map<string, HomeCalendarItem[]> {
  const itemsByDate = new Map<string, HomeCalendarItem[]>();
  const coveredNoteDates = new Set<string>();
  const add = (item: HomeCalendarItem) => {
    const dateKey = toLocalDateKey(item.scheduledAt);
    if (!dateKey) return;
    coveredNoteDates.add(`${item.sourceNoteId}|${item.kind}|${dateKey}`);
    itemsByDate.set(dateKey, [...(itemsByDate.get(dateKey) ?? []), item]);
  };

  for (const task of tasks) {
    const scheduledAt = task.dueAt ?? task.startsAt;
    if (task.status !== "pending" || !scheduledAt) continue;
    add({
      id: task.id,
      kind: "task",
      title: task.title,
      sourceNoteId: task.sourceNoteId,
      scheduledAt,
    });
  }

  for (const intent of calendarIntents) {
    const scheduledAt = intent.kind === "reminder"
      ? intent.remindAt ?? intent.dueAt ?? intent.startsAt
      : intent.startsAt ?? intent.dueAt ?? intent.remindAt;
    if (intent.status !== "pending" || !scheduledAt) continue;
    add({
      id: intent.id,
      kind: intent.kind,
      title: intent.title,
      sourceNoteId: intent.sourceNoteId,
      scheduledAt,
    });
  }

  // The dashboard must remain useful even when a note has not been opened and
  // converted into a Structured Note yet. Dates written directly in a note are
  // therefore added as local fallback items. Stored Structured Note items win
  // for the same note, kind, and date so the fallback never creates duplicates.
  for (const note of notes) {
    for (const item of extractNoteCalendarItems(note)) {
      const dateKey = toLocalDateKey(item.scheduledAt);
      if (!dateKey || coveredNoteDates.has(`${item.sourceNoteId}|${item.kind}|${dateKey}`)) continue;
      add(item);
    }
  }

  return itemsByDate;
}

export function extractNoteCalendarItems(note: HomeCalendarNoteSource): HomeCalendarItem[] {
  const transcript = note.getTranscript().trim();
  if (!transcript) return [];
  const reference = new Date(note.getCreatedAt());
  const referenceYear = Number.isNaN(reference.getTime()) ? new Date().getFullYear() : reference.getFullYear();
  const mentions = extractNoteDateMentions(transcript, referenceYear);

  return mentions.map((mention, position) => {
    const nearby = transcript.slice(Math.max(0, mention.index - 34), Math.min(transcript.length, mention.end + 42));
    const before = transcript.slice(Math.max(0, mention.index - 18), mention.index);
    const after = transcript.slice(mention.end, Math.min(transcript.length, mention.end + 26));
    const kind = isReminderDate(before, after)
      ? "reminder" as const
      : EVENT_CONTEXT_PATTERN.test(nearby)
        ? "calendar" as const
        : TASK_CONTEXT_PATTERN.test(nearby)
          ? "task" as const
          : "calendar" as const;

    return {
      id: `note-date-${note.getId()}-${mention.dateKey}-${position}`,
      kind,
      title: calendarItemTitle(note, transcript, nearby, kind),
      sourceNoteId: note.getId(),
      scheduledAt: mention.dateKey,
    };
  });
}

function extractNoteDateMentions(value: string, referenceYear: number): NoteDateMention[] {
  const mentions: NoteDateMention[] = [];
  for (const match of value.matchAll(NOTE_DATE_PATTERN)) {
    const year = Number(match[1] ?? referenceYear);
    addDateMention(mentions, year, Number(match[2]), Number(match[3]), match.index, match[0].length);
  }
  for (const match of value.matchAll(NOTE_ISO_DATE_PATTERN)) {
    addDateMention(mentions, Number(match[1]), Number(match[2]), Number(match[3]), match.index, match[0].length);
  }
  return mentions.sort((left, right) => left.index - right.index);
}

function addDateMention(target: NoteDateMention[], year: number, month: number, day: number, index: number, length: number): void {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
  if (target.some((item) => item.index === index)) return;
  target.push({
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    end: index + length,
    index,
  });
}

function isReminderDate(before: string, after: string): boolean {
  // Covers both "提醒我在 8 月 25 日" and "請在 8 月 25 號提醒我".
  return /(?:提醒|記得|记得|remind|remember)[^。！？.!?]{0,14}$/iu.test(before)
    || /^[^。！？.!?]{0,8}(?:提醒|記得|记得|remind|remember)/iu.test(after);
}

function calendarItemTitle(note: HomeCalendarNoteSource, transcript: string, nearby: string, kind: HomeCalendarItem["kind"]): string {
  if (kind === "reminder") {
    const reminderAction = nearby.match(/(?:提醒(?:我|我們|我们)?|記得|记得)\s*(?:要|去|需(?:要)?)?\s*([^。！？.!?]{2,36})/iu)?.[1]
      ?.replace(/^(?:在|於|于)\s*/u, "")
      .trim();
    if (reminderAction) return reminderAction;
  }

  const event = nearby.match(/工作面試|工作面试|面試|面试|開會|开会|會議|会议|約會|约会|訪談|访谈|預約|预约|行程|活動|活动|meeting|appointment|interview|conference|call/iu)?.[0];
  if (event) return event;
  const noteName = note.getName()?.trim();
  if (noteName) return noteName;
  return transcript.length > 42 ? `${transcript.slice(0, 42).trim()}…` : transcript;
}
