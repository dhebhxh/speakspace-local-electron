export type ResolvedCoreNoteTime = {
  raw: string;
  normalized: string | null;
  resolvedDate: string | null;
  display: string;
  precision: "month" | "date" | "datetime" | "time-only" | "unresolved";
  isApproximate: boolean;
};

const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1, "周一": 1, "星期一": 1,
  tuesday: 2, tue: 2, tues: 2, "周二": 2, "星期二": 2,
  wednesday: 3, wed: 3, "周三": 3, "星期三": 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, "周四": 4, "星期四": 4,
  friday: 5, fri: 5, "周五": 5, "星期五": 5,
  saturday: 6, sat: 6, "周六": 6, "星期六": 6,
  sunday: 0, sun: 0, "周日": 0, "周天": 0, "星期日": 0, "星期天": 0,
};
const CHINESE_NUMBERS: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
const ENGLISH_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

const EN_CLOCK_SOURCE = String.raw`(?:(?:1[0-2]|0?\d)(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)`;
const EN_DATE_SOURCE = String.raw`(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})`;
const EN_WEEKDAY_SOURCE = String.raw`(?:(?:next|this)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)`;
const CORE_TIME_PHRASE_PATTERNS = [
  new RegExp(String.raw`\b(?:at\s+${EN_CLOCK_SOURCE}\s+)?(?:before|by|on|until|from)\s+${EN_DATE_SOURCE}(?:\s+at\s+${EN_CLOCK_SOURCE})?\b`, "iu"),
  new RegExp(String.raw`\b(?:at\s+${EN_CLOCK_SOURCE}\s+on\s+)?${EN_DATE_SOURCE}(?:\s+at\s+${EN_CLOCK_SOURCE})?\b`, "iu"),
  new RegExp(String.raw`\b(?:before|by|on|until|from|at)\s+${EN_WEEKDAY_SOURCE}(?:\s+at\s+${EN_CLOCK_SOURCE})?\b`, "iu"),
  new RegExp(String.raw`\b${EN_WEEKDAY_SOURCE}(?:\s+at\s+${EN_CLOCK_SOURCE})?\b`, "iu"),
  new RegExp(String.raw`\b(?:in\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?(?:\s+(?:later|from now))?\b`, "iu"),
  new RegExp(String.raw`\b(?:before|by|on|until|from|at)?\s*(?:the\s+)?(?:day after tomorrow|tomorrow|today|tonight|next month)(?:\s+at\s+${EN_CLOCK_SOURCE})?\b`, "iu"),
  new RegExp(String.raw`\b(?:at\s+)?${EN_CLOCK_SOURCE}(?:\s+on\s+(?:the\s+)?same day)?\b`, "iu"),
  /(?:在|于|截至|截止(?:到)?|之前|前|到)?\s*(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号](?:\s*(?:上午|早上|中午|下午|晚上)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*[点时](?:\s*\d{1,2}\s*分?)?)?/u,
  /(?:在|于|截至|截止(?:到)?|之前|前|到)?\s*(?:(?:下|本)?(?:周|星期)[一二三四五六日天]|今天|明天|后天|今晚|下个月)(?:\s*(?:上午|早上|中午|下午|晚上)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*[点时](?:\s*\d{1,2}\s*分?)?)?/u,
  /(?:\d+|[一二两三四五六七八九十]+)\s*小时后/u,
  /(?:上午|早上|中午|下午|晚上)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*[点时](?:\s*\d{1,2}\s*分?)?/u,
] as const;

/** Keeps the existing free-form time-field contract while removing surrounding task prose. */
export function extractCoreNoteTimeExpression(expression: unknown): string | null {
  if (typeof expression !== "string" || !expression.trim()) return null;
  const matches = CORE_TIME_PHRASE_PATTERNS
    .map((pattern) => expression.trim().match(pattern)?.[0]?.trim() ?? "")
    .filter(Boolean)
    .map((match) => match.replace(/^[,;，；]\s*|\s*[,.!?;，。！？；]+$/gu, "").trim());
  if (!matches.length) return null;
  return matches.reduce((best, candidate) => candidate.length > best.length ? candidate : best);
}

export function getLocalReferenceTime(now: Date = new Date()): { instant: Date; localIso: string; timezone: string } {
  return { instant: new Date(now), localIso: formatLocalDateTime(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local" };
}

export function resolveCoreNoteTime(expression: unknown, reference: Date): ResolvedCoreNoteTime | null {
  if (typeof expression !== "string" || !expression.trim()) return null;
  const raw = expression.trim();
  const lower = raw.toLocaleLowerCase();
  if (["null", "unknown", "undefined", "none", "n/a"].includes(lower)) return null;
  const approximate = /\b(around|about|approximately)\b|大约|约|左右/.test(lower);
  const relativeHours = lower.match(/(?:in\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*hours?\s*(?:later|from now)?|([一二两三四五六七八九十]+)\s*小时后/);
  if (relativeHours) {
    const hours = relativeHours[1] ? (/^\d+$/.test(relativeHours[1]) ? Number(relativeHours[1]) : ENGLISH_NUMBERS[relativeHours[1]] ?? null) : chineseNumber(relativeHours[2]);
    if (hours !== null) {
      const date = new Date(reference.getTime() + hours * 60 * 60 * 1000);
      return result(raw, formatLocalDateTime(date), formatDate(date), "datetime", approximate);
    }
  }

  let date: Date | null = parseExplicitDate(lower);
  if (date) {
    // An explicit year-month-day always wins over relative words elsewhere in the phrase.
  } else if (/\bday after tomorrow\b|后天/.test(lower)) date = addDays(startOfDay(reference), 2);
  else if (/\btomorrow\b|明天/.test(lower)) date = addDays(startOfDay(reference), 1);
  else if (/\btoday\b|今天/.test(lower)) date = startOfDay(reference);
  else {
    const weekday = findWeekday(lower);
    if (weekday !== null) {
      const isNext = /\bnext\b|下周|下星期/.test(lower);
      date = weekdayDate(reference, weekday, isNext);
    }
  }

  if (/\bnext month\b|下个月/.test(lower)) {
    const month = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    return result(raw, formatMonth(month), null, "month", approximate);
  }

  const time = parseClockTime(lower);
  if (date && time) {
    date.setHours(time.hour, time.minute, 0, 0);
    return result(raw, formatLocalDateTime(date), formatDate(date), "datetime", approximate);
  }
  if (date) return result(raw, formatDate(date), formatDate(date), "date", approximate);
  if (time) return result(raw, null, null, "time-only", approximate);
  return result(raw, null, null, "unresolved", approximate);
}

function result(raw: string, normalized: string | null, resolvedDate: string | null, precision: ResolvedCoreNoteTime["precision"], isApproximate: boolean): ResolvedCoreNoteTime {
  return { raw, normalized, resolvedDate, display: raw, precision, isApproximate };
}
function startOfDay(value: Date): Date { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function addDays(value: Date, days: number): Date { const result = new Date(value); result.setDate(result.getDate() + days); return result; }
function weekdayDate(reference: Date, target: number, nextWeek: boolean): Date {
  const base = startOfDay(reference);
  if (nextWeek) {
    const daysToMonday = (8 - base.getDay()) % 7 || 7;
    return addDays(base, daysToMonday + ((target + 6) % 7));
  }
  const delta = (target - base.getDay() + 7) % 7;
  return addDays(base, delta);
}
function findWeekday(value: string): number | null {
  for (const [name, day] of Object.entries(WEEKDAYS)) if (value.includes(name)) return day;
  return null;
}
function parseExplicitDate(value: string): Date | null {
  const numeric = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) ?? value.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  const english = value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/);
  if (!numeric && !english) return null;
  const year = Number(numeric?.[1] ?? english?.[3]);
  const month = numeric
    ? Number(numeric[2])
    : ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(english![2]) + 1;
  const day = Number(numeric?.[3] ?? english?.[1]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
function parseClockTime(value: string): { hour: number; minute: number } | null {
  const english = value.match(/\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*(am|pm)\b/);
  if (english) {
    let hour = Number(english[1]) % 12;
    if (english[3] === "pm") hour += 12;
    return { hour, minute: Number(english[2] ?? 0) };
  }
  const twentyFourHour = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    return { hour: Number(twentyFourHour[1]), minute: Number(twentyFourHour[2]) };
  }
  const chinese = value.match(/(上午|早上|中午|下午|晚上)?\s*(\d{1,2}|[一二三四五六七八九十]+)\s*[点时](?:\s*(\d{1,2})\s*分?)?/);
  if (!chinese) return null;
  const parsedHour = /^\d+$/.test(chinese[2]) ? Number(chinese[2]) : chineseNumber(chinese[2]);
  if (parsedHour === null || parsedHour > 23) return null;
  let hour = parsedHour;
  if ((chinese[1] === "下午" || chinese[1] === "晚上") && hour < 12) hour += 12;
  if (chinese[1] === "中午" && hour < 11) hour += 12;
  return { hour, minute: Number(chinese[3] ?? 0) };
}
function chineseNumber(value: string | undefined): number | null { return value ? (CHINESE_NUMBERS[value] ?? null) : null; }
function pad(value: number): string { return String(value).padStart(2, "0"); }
function formatDate(value: Date): string { return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`; }
function formatMonth(value: Date): string { return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`; }
function formatLocalDateTime(value: Date): string {
  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
  return `${formatDate(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}${offset}`;
}
