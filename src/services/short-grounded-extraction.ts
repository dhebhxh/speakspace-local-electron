const CJK_PATTERN = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu;
const MAX_CONTENT_UNITS = 180;
const MAX_SENTENCES = 8;

const REMINDER_PATTERN = /(?:請|请)?(?:記得|记得)|提醒(?:我|我們|我们)?|\b(?:remind|remember)\b/iu;
const ACTION_VERB_PATTERN = /完成|提交|準備|准备|處理|处理|聯絡|联系|回覆|回复|寄送|繳交|缴交|確認|确认|參加|参加|出席|製作|制作|更新|整理|安排|預約|预约|\b(?:finish|complete|submit|prepare|send|contact|reply|attend|update|arrange|book)\b/iu;
const TASK_PATTERN = /待辦|待办|任務|任务|需要|必須|必须|務必|务必|\b(?:todo|task|need to|must|have to)\b/iu;
const COMPLETED_PATTERN = /(?:已|已经|已經|剛|刚)(?:經|经)?(?:完成|提交|處理|处理|寄出)|\b(?:already|has|have|was|were)\s+(?:finished|completed|submitted|sent)\b/iu;
const EVENT_PATTERN = /開會|开会|會議|会议|約會|约会|訪談|访谈|面試|面试|\b(?:meeting|appointment|interview|conference|call)\b/iu;
const QUESTION_PATTERN = /[?？]|疑問|疑问|不確定|不确定|\b(?:question|unknown|unclear)\b/iu;
const RELATION_PATTERN = /因為|因为|所以|因此|導致|导致|取決於|取决于|\b(?:because|therefore|causes?|depends? on|results? in)\b/iu;
const PERSPECTIVE_PATTERN = /認為|认为|覺得|觉得|偏好|擔心|担心|\b(?:think|believe|prefer|concerned|in my view)\b/iu;
const FACT_PATTERN = /代號|代号|地點|地点|位於|位于|(?:是|為|为)[「"']?[^。！？.!?]+|\b(?:is|are|was|were|means|called|code|located)\b/iu;

export type DeterministicOutputItem = {
  title: string;
  description: null;
  startsAtExpression: string | null;
  dueAtExpression: string | null;
};

export type DeterministicOutputCalendar = DeterministicOutputItem & {
  endsAtExpression: null;
  remindAtExpression: string | null;
  allDay: boolean;
  timezone: null;
};

export type DeterministicShortInsight = {
  content: { summary: string; keyPoints: string[] };
  intents: {
    tasks: (DeterministicOutputItem & { actionItems: [] })[];
    reminders: (DeterministicOutputItem & { remindAtExpression: string | null })[];
    calendarIntents: DeterministicOutputCalendar[];
  };
};

export function extractDeterministicShortInsight(input: string): DeterministicShortInsight | null {
  const sentences = getShortGroundedSentences(input);
  if (!sentences) return null;

  const tasks: DeterministicShortInsight["intents"]["tasks"] = [];
  const reminders: DeterministicShortInsight["intents"]["reminders"] = [];
  const calendarIntents: DeterministicShortInsight["intents"]["calendarIntents"] = [];
  let carriedDate: string | null = null;

  for (const sentence of sentences) {
    const explicitDate = extractExplicitDate(sentence);
    if (explicitDate) carriedDate = explicitDate;
    const timeExpression = expressionWithDateContext(sentence, explicitDate, carriedDate);
    const reminder = REMINDER_PATTERN.test(sentence);
    const task = !COMPLETED_PATTERN.test(sentence) && (TASK_PATTERN.test(sentence) || (reminder && ACTION_VERB_PATTERN.test(sentence)));
    const event = EVENT_PATTERN.test(sentence);
    const title = cleanIntentTitle(sentence);
    const reminderDate = reminder ? dateNearestKeyword(sentence, REMINDER_PATTERN) : null;
    const eventDate = event ? dateNearestKeyword(sentence, EVENT_PATTERN) : null;
    const taskTimeExpression = eventDate && reminder ? expressionForDate(sentence, eventDate) : timeExpression;
    const reminderTimeExpression = reminderDate ? expressionForDate(sentence, reminderDate) : timeExpression;
    const eventTimeExpression = eventDate ? expressionForDate(sentence, eventDate) : timeExpression;

    if (task) {
      tasks.push({ title, description: null, startsAtExpression: null, dueAtExpression: taskTimeExpression, actionItems: [] });
    }
    if (reminder) {
      reminders.push({ title, description: null, startsAtExpression: null, dueAtExpression: reminderTimeExpression, remindAtExpression: reminderTimeExpression });
    }
    if (event) {
      calendarIntents.push({
        title,
        description: null,
        startsAtExpression: eventTimeExpression,
        dueAtExpression: null,
        endsAtExpression: null,
        remindAtExpression: null,
        allDay: !extractClockTime(sentence),
        timezone: null,
      });
    }
  }

  return {
    content: { summary: input.trim(), keyPoints: sentences },
    intents: { tasks, reminders, calendarIntents },
  };
}

export function extractDeterministicShortKnowledge(
  input: string,
  scenario: string,
  sectionKeys: readonly string[],
): Record<string, string[]> | null {
  const sentences = getShortGroundedSentences(input);
  if (!sentences) return null;
  const sections = Object.fromEntries(sectionKeys.map((key) => [key, [] as string[]]));
  const add = (key: string, sentence: string) => {
    const target = sections[key];
    if (target && !target.includes(sentence)) target.push(sentence);
  };

  for (const sentence of sentences) {
    const isActionOnly = REMINDER_PATTERN.test(sentence) || TASK_PATTERN.test(sentence) || EVENT_PATTERN.test(sentence);
    const isQuestion = QUESTION_PATTERN.test(sentence);
    const hasRelationship = RELATION_PATTERN.test(sentence);
    const hasPerspective = PERSPECTIVE_PATTERN.test(sentence);

    if (scenario === "general") {
      if (isQuestion) add("openQuestions", sentence);
      else if (hasRelationship) add("relationships", sentence);
      else if (hasPerspective) add("perspectives", sentence);
      else if (!isActionOnly && FACT_PATTERN.test(sentence)) add("details", sentence);
      else if (!isActionOnly) add("background", sentence);
    } else if (scenario === "meeting") {
      if (isQuestion) add("openQuestions", sentence);
      else if (/決定|决定|\bdecid(?:e|ed)\b/iu.test(sentence)) add("decisions", sentence);
      else if (/同意|共識|共识|\bagree(?:d|ment)?\b/iu.test(sentence)) add("agreements", sentence);
      else if (/不同意|反對|反对|分歧|\bdisagree|object(?:ed|ion)?\b/iu.test(sentence)) add("disagreements", sentence);
      else if (/風險|风险|問題|问题|阻礙|阻碍|\b(?:risk|issue|blocker)\b/iu.test(sentence)) add("risks", sentence);
      else if (!isActionOnly) add("discussionTopics", sentence);
    } else if (scenario === "lecture") {
      if (isQuestion) add("openQuestions", sentence);
      else if (hasRelationship) add("relationships", sentence);
      else if (/例如|舉例|举例|\b(?:example|for instance)\b/iu.test(sentence)) add("examples", sentence);
      else if (/但是|但|除外|限制|\b(?:except|limitation|caveat)\b/iu.test(sentence)) add("misunderstandings", sentence);
      else if (/因為|因为|如何|怎麼|怎么|\b(?:because|how|why)\b/iu.test(sentence)) add("explanations", sentence);
      else if (!isActionOnly) add("concepts", sentence);
    } else if (scenario === "consultation") {
      if (isQuestion) add("uncertainties", sentence);
      else if (/建議|建议|應該|应该|\b(?:recommend|advice|should)\b/iu.test(sentence)) add("advice", sentence);
      else if (/選項|选项|方案|替代|\b(?:option|alternative|trade-off)\b/iu.test(sentence)) add("options", sentence);
      else if (/風險|风险|警告|限制|\b(?:risk|warning|constraint)\b/iu.test(sentence)) add("constraints", sentence);
      else if (/評估|评估|診斷|诊断|\bassessment\b/iu.test(sentence)) add("assessment", sentence);
      else if (!isActionOnly) add("situation", sentence);
    } else if (scenario === "interview") {
      if (hasPerspective) add("perspectives", sentence);
      else if (/需要|痛點|痛点|困難|困难|\b(?:need|pain point|frustrat)\w*\b/iu.test(sentence)) add("needs", sentence);
      else if (/動機|动机|因為|因为|\b(?:motivat|because)\w*\b/iu.test(sentence)) add("motivations", sentence);
      else if (!isActionOnly) add("behaviors", sentence);
    } else if (scenario === "brainstorm") {
      if (isQuestion) add("openQuestions", sentence);
      else if (/優點|优点|缺點|缺点|可行|風險|风险|\b(?:pro|con|feasible|risk)\b/iu.test(sentence)) add("evaluation", sentence);
      else if (/或者|或是|替代|\b(?:alternative|instead)\b/iu.test(sentence)) add("alternatives", sentence);
      else if (/優先|优先|看好|值得|\b(?:promising|priorit)\w*\b/iu.test(sentence)) add("promisingDirections", sentence);
      else if (hasRelationship) add("connections", sentence);
      else if (!isActionOnly) add("ideas", sentence);
    }
  }

  return sections;
}

export function getShortGroundedSentences(input: string): string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cjkCharacters = trimmed.match(CJK_PATTERN)?.length ?? 0;
  const nonCjkWords = trimmed.replace(CJK_PATTERN, " ").match(/[\p{L}\p{N}]+/gu) ?? [];
  const contentUnits = cjkCharacters + nonCjkWords.length;
  const sentences = trimmed.split(/[。！？.!?\n]+/u).map((value) => value.trim()).filter(Boolean);
  return contentUnits <= MAX_CONTENT_UNITS && sentences.length > 0 && sentences.length <= MAX_SENTENCES ? sentences : null;
}

function extractExplicitDate(value: string): string | null {
  return value.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/u)?.[0]
    ?? value.match(/(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日號号]/u)?.[0]
    ?? null;
}

type IndexedDateExpression = { expression: string; index: number; end: number };

function dateExpressions(value: string): IndexedDateExpression[] {
  const expressions: IndexedDateExpression[] = [];
  for (const match of value.matchAll(/\b\d{4}-\d{1,2}-\d{1,2}\b|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日號号]/gu)) {
    expressions.push({ expression: match[0], index: match.index, end: match.index + match[0].length });
  }
  return expressions;
}

function dateNearestKeyword(value: string, keywordPattern: RegExp): IndexedDateExpression | null {
  const dates = dateExpressions(value);
  const keyword = keywordPattern.exec(value);
  if (!keyword || dates.length === 0) return null;
  const keywordIndex = keyword.index;
  const preceding = dates.filter((date) => date.end <= keywordIndex);
  if (preceding.length > 0) return preceding[preceding.length - 1];
  return dates.reduce((closest, date) => Math.abs(date.index - keywordIndex) < Math.abs(closest.index - keywordIndex) ? date : closest);
}

function expressionForDate(sentence: string, date: IndexedDateExpression): string {
  const clock = extractClockTime(sentence);
  return clock ? `${date.expression} ${clock}` : date.expression;
}

function extractClockTime(value: string): string | null {
  return value.match(/(?:上午|早上|中午|下午|晚上)?\s*(?:\d{1,2}|[一二兩两三四五六七八九十]+)\s*[點点時时](?:\s*\d{1,2}\s*分?)?/u)?.[0]?.trim()
    ?? value.match(/\b(?:1[0-2]|0?\d)(?::[0-5]\d)?\s*(?:am|pm)\b/iu)?.[0]
    ?? null;
}

function expressionWithDateContext(sentence: string, explicitDate: string | null, carriedDate: string | null): string | null {
  const clock = extractClockTime(sentence);
  if (explicitDate) return sentence;
  if (clock && carriedDate) return `${carriedDate} ${clock}`;
  return clock ? sentence : null;
}

function cleanIntentTitle(sentence: string): string {
  const cleaned = sentence
    .replace(/^(?:請|请)?(?:記得|记得)\s*/u, "")
    .replace(/^提醒(?:我|我們|我们)?\s*/u, "")
    .replace(/^\b(?:please\s+)?(?:remind me to|remember to)\s*/iu, "")
    .trim();
  return cleaned || sentence;
}
