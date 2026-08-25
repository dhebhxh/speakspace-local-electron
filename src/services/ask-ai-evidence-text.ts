const MIN_CHUNK_WORDS = 4;
const MIN_CHUNK_CHARS = 24;
const MAX_CHUNK_CHARS = 240;

const CJK_CHARACTER_PATTERN =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;
const TOKEN_RUN_PATTERN =
  /[a-z0-9]+|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+/g;

const CROSS_LANGUAGE_TOPIC_GROUPS: readonly { english: RegExp; cjk: RegExp }[] = [
  { english: /\b(?:meeting|appointment|conference|interview|call)\b/i, cjk: /開會|开会|會議|会议|約會|约会|訪談|访谈|面試|面试/ },
  { english: /\b(?:office|location|place|venue)\b/i, cjk: /辦公室|办公室|地點|地点|位置|場所|场所/ },
  { english: /\b(?:project|assignment)\b/i, cjk: /專案|项目|任務|任务/ },
  { english: /\b(?:code|identifier|codename)\b/i, cjk: /代號|代号|編號|编号/ },
  { english: /\b(?:task|todo|reminder|deadline|due)\b/i, cjk: /待辦|待办|提醒|截止|到期/ },
  { english: /\b(?:date|time|today|tomorrow|morning|afternoon|evening)\b/i, cjk: /日期|時間|时间|今天|明天|上午|下午|晚上|點|点/ },
  { english: /\b(?:note|transcript|recording)\b/i, cjk: /筆記|笔记|轉錄|转录|逐字稿|錄音|录音/ },
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "do",
  "does",
  "did",
  "for",
  "had",
  "has",
  "have",
  "how",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "who",
]);

const CJK_STOPWORDS = new Set([
  "一",
  "个",
  "了",
  "么",
  "与",
  "他",
  "们",
  "你",
  "和",
  "呢",
  "吗",
  "在",
  "她",
  "它",
  "就",
  "我",
  "是",
  "本",
  "的",
  "要",
  "这",
  "那",
  "这个",
  "那个",
  "什么",
]);

export function tokenizeMeaningful(text: string): string[] {
  const tokens: string[] = [];

  for (const segment of normalizeForSearch(text).split(/\s+/)) {
    const runs = segment.match(TOKEN_RUN_PATTERN) ?? [];
    for (const run of runs) {
      if (CJK_CHARACTER_PATTERN.test(run)) {
        tokens.push(...tokenizeCjkRun(run));
        continue;
      }

      const token = stemToken(run);
      if (token.length > 1 && !STOPWORDS.has(token)) {
        tokens.push(token);
      }
    }
  }

  return [...new Set(tokens)];
}

export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countCrossLanguageTopicMatches(question: string, evidence: string): number {
  const normalizedQuestion = question.normalize("NFKC").toLowerCase();
  const normalizedEvidence = evidence.normalize("NFKC").toLowerCase();
  return CROSS_LANGUAGE_TOPIC_GROUPS.filter(({ english, cjk }) =>
    (english.test(normalizedQuestion) && cjk.test(normalizedEvidence)) ||
    (cjk.test(normalizedQuestion) && english.test(normalizedEvidence)),
  ).length;
}

export function buildDirectGroundedEvidenceAnswer(question: string, verifiedEvidence: string[]): string | null {
  const evidence = [...new Set(verifiedEvidence.map(normalizeEvidenceText).filter(Boolean))];
  const evidenceText = evidence.join(" ");
  if (!evidenceText || evidenceText.length > 240 || isTranscriptOverviewQuestion(question)) return null;

  const normalizedQuestion = normalizeForSearch(question);
  const asksWhere = /\bwhere\b|哪裡|哪里|何處|何处|地點|地点|位置/u.test(normalizedQuestion);
  const asksWho = /\bwho\b|\bwith\b|誰|谁/u.test(normalizedQuestion);
  const meeting = evidenceText.match(/(?:和|與|与)([^，。,.]{2,16}?)在([^，。,.]{2,40}?)(?:開會|开会|舉行會議|举行会议)/u);
  if (meeting && (asksWhere || asksWho)) {
    const person = meeting[1]?.trim();
    const location = meeting[2]?.trim();
    if (person && location) {
      if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(question)) {
        if (asksWhere && asksWho) return `會議地點是${location}，與會者是${person}。`;
        if (asksWhere) return `會議地點是${location}。`;
        return `與會者是${person}。`;
      }
      if (asksWhere && asksWho) return `The meeting is at ${location}, with ${person}.`;
      if (asksWhere) return `The meeting is at ${location}.`;
      return `The meeting is with ${person}.`;
    }
  }

  const isDirectFactQuestion = /^(?:what|which|who|when|where)\b|什麼|什么|哪個|哪个|誰|谁|何時|何时|哪裡|哪里/u.test(normalizedQuestion);
  if (!isDirectFactQuestion || /\bwhy\b|\bhow\b|為什麼|为什么|如何|怎麼|怎么/u.test(normalizedQuestion)) return null;
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(question)
    ? evidence.join("\n")
    : `According to the transcript: ${evidence.join(" ")}`;
}

function tokenizeCjkRun(run: string): string[] {
  const characters = Array.from(run);
  const tokens = characters.filter((token) => !CJK_STOPWORDS.has(token));

  for (let index = 0; index < characters.length - 1; index += 1) {
    const token = `${characters[index]}${characters[index + 1]}`;
    if (!CJK_STOPWORDS.has(token)) {
      tokens.push(token);
    }
  }

  return tokens;
}

export function isTranscriptOverviewQuestion(question: string): boolean {
  const normalizedQuestion = normalizeForSearch(question);
  const compactQuestion = normalizedQuestion.replace(/\s+/g, "");

  const isChineseOverview =
    /(?:这|该|那)(?:个|份|篇|段)?(?:笔记|转录|转写|记录|录音)(?:主要)?(?:说|讲|写|记录|包含|关于)(?:了|的|是)?什么/.test(
      compactQuestion,
    ) ||
    /(?:笔记|转录|转写|记录|录音)(?:的)?(?:主要)?内容(?:是)?什么/.test(
      compactQuestion,
    ) ||
    /(?:总结|概括|概述|梳理)(?:一下)?(?:这|该|那)?(?:个|份|篇|段)?(?:笔记|转录|转写|记录|录音)?/.test(
      compactQuestion,
    );

  if (isChineseOverview) {
    return true;
  }

  return (
    /\bwhat (?:does|did) (?:this|the|selected) (?:note|transcript|recording) say\b/.test(
      normalizedQuestion,
    ) ||
    /\bwhat is (?:this|the|selected) (?:note|transcript|recording) about\b/.test(
      normalizedQuestion,
    ) ||
    /\bsummari[sz]e\b.*\b(?:note|transcript|recording)\b/.test(
      normalizedQuestion,
    ) ||
    /\b(?:give|provide)\b.*\b(?:overview|summary)\b/.test(
      normalizedQuestion,
    )
  );
}

export function findMissingOverviewNumberAtoms(
  question: string,
  evidenceText: string,
  answerText: string,
): string[] {
  if (!isTranscriptOverviewQuestion(question)) {
    return [];
  }

  const evidenceNumbers = new Set(
    evidenceText.match(/\d+(?::\d{2})?/g) ?? [],
  );
  const answerNumbers = new Set(answerText.match(/\d+(?::\d{2})?/g) ?? []);
  return [...evidenceNumbers].filter((number) => !answerNumbers.has(number));
}

export function stemToken(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }
  if (token.length > 4 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

export function chunkTranscriptText(transcript: string): string[] {
  const paragraphs = transcript
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = splitParagraphIntoAtomicText(paragraph);

    for (const sentence of sentences) {
      if (sentence.length > MAX_CHUNK_CHARS) {
        chunks.push(...splitLongText(sentence));
        continue;
      }

      chunks.push(sentence);
    }
  }

  return chunks.filter(isUsefulChunk);
}

function splitParagraphIntoAtomicText(paragraph: string): string[] {
  const hasSentenceBoundary = /[.!?。！？；]/.test(paragraph);
  if (hasSentenceBoundary) {
    return splitIntoSentences(normalizeEvidenceText(paragraph));
  }

  return paragraph
    .split(/\n+/)
    .map(normalizeEvidenceText)
    .filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(
    /[^.!?。！？；]+[.!?。！？；]+["'）)\]]*|[^.!?。！？；]+$/g,
  );
  return (matches ?? [text]).map(normalizeEvidenceText).filter(Boolean);
}

function splitLongText(text: string): string[] {
  if (!/\s/.test(text)) {
    const characters = Array.from(text);
    const chunks: string[] = [];
    for (let index = 0; index < characters.length; index += MAX_CHUNK_CHARS) {
      chunks.push(characters.slice(index, index + MAX_CHUNK_CHARS).join(""));
    }
    return chunks;
  }

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let buffer = "";

  for (const word of words) {
    const candidate = buffer.length > 0 ? `${buffer} ${word}` : word;
    if (candidate.length <= MAX_CHUNK_CHARS) {
      buffer = candidate;
      continue;
    }

    if (buffer.length > 0) {
      chunks.push(buffer);
    }
    buffer = word;
  }

  if (buffer.length > 0) {
    chunks.push(buffer);
  }

  return chunks;
}

function isUsefulChunk(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  const hasSpecificToken = /[A-Z0-9]/.test(text);
  const hasCjkText = CJK_CHARACTER_PATTERN.test(text);
  return (
    (hasCjkText && Array.from(text).length >= 3) ||
    (text.length >= MIN_CHUNK_CHARS && words.length >= MIN_CHUNK_WORDS) ||
    (text.length >= 3 && hasSpecificToken)
  );
}

export function normalizeEvidenceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
