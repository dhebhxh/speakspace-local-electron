const CJK_PATTERN = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu;
const INTENT_OR_TIME_PATTERN = /\b(?:remind|remember|todo|task|need|must|should|meeting|appointment|schedule|deadline|due|today|tomorrow|am|pm)\b|提醒|記得|待辦|任务|任務|會議|会议|約會|约会|截止|明天|今天|\d{1,2}[:/\-]\d{1,2}/iu;

export function shouldUseSparseGroundedFallback(input: string): boolean {
  const cjkCharacters = input.match(CJK_PATTERN)?.length ?? 0;
  const nonCjkWords = input.replace(CJK_PATTERN, " ").match(/[\p{L}\p{N}]+/gu) ?? [];
  const contentUnits = cjkCharacters + nonCjkWords.length;
  return contentUnits > 0 && contentUnits <= 12 && !INTENT_OR_TIME_PATTERN.test(input);
}
