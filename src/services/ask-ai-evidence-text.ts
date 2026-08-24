const MIN_CHUNK_WORDS = 4;
const MIN_CHUNK_CHARS = 24;
const MAX_CHUNK_CHARS = 240;

const CJK_CHARACTER_PATTERN =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;
const TOKEN_RUN_PATTERN =
  /[a-z0-9]+|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+/g;

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

const GENERIC_CONTEXT_TOKENS = new Set([
  "app",
  "application",
  "note",
  "project",
  "recording",
  "team",
  "transcript",
]);

const CJK_DIRECT_EVIDENCE_QUESTION_NOISE =
  /(?:当前所选|发生了什么|发生什么|是干什么的|是做什么的|能做什么|可以做什么|能够做什么|要干什么|要做什么|在干什么|在做什么|有什么用|什么时候|什么时间|截止日期|负责人|谁负责|由谁|谁来|是什么|是谁|叫什么|干什么|做什么|干啥|做啥|为什么|哪一天|可不可以|有没有|是不是|请问|所选|为何|怎么|如何|哪里|哪儿|何处|哪天|何时|多少|几个|负责|开发|截止|日期|时间|发生|用途|目的|位置|名称|名字|标题|原因|数量|总数|用来|用于|保存|存储|笔记|转录|转写|记录|录音|内容|里面|里边|这个|那个|这些|那些|一下|什么|谁|哪位|何人|是否|能否|的)/g;

export type ChineseRetrievalIntent =
  | "name-or-identity"
  | "purpose-or-utility"
  | "time-or-date"
  | "responsibility"
  | "capability-or-action"
  | "creator-or-authorship"
  | "reason-or-cause"
  | "command-or-procedure"
  | "location"
  | "quantity"
  | "summary-or-overview";

export type ChineseFollowUpReason =
  | "pronoun"
  | "ellipsis"
  | "demonstrative"
  | "referential-phrase";

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

export function hasDirectEvidenceTokenCoverage(
  question: string,
  evidence: string[],
): boolean {
  if (evidence.length === 0) {
    return false;
  }

  const questionAnchors = extractDirectEvidenceQuestionAnchors(question);
  if (questionAnchors.length === 0) {
    return false;
  }

  const combinedEvidence = evidence.join(" ");
  const compactEvidence = normalizeForSearch(combinedEvidence).replace(
    /\s+/g,
    "",
  );
  const evidenceTokens = new Set(tokenizeMeaningful(combinedEvidence));

  return questionAnchors.every((anchor) =>
    CJK_CHARACTER_PATTERN.test(anchor) || /\d+年/.test(anchor)
      ? compactEvidence.includes(anchor)
      : evidenceTokens.has(anchor),
  );
}

export function hasUnmatchedDirectEvidenceAnchor(
  question: string,
  evidence: string[],
): boolean {
  const questionAnchors = extractDirectEvidenceQuestionAnchors(question);
  return (
    questionAnchors.length > 0 &&
    !hasDirectEvidenceTokenCoverage(question, evidence)
  );
}

function extractDirectEvidenceQuestionAnchors(question: string): string[] {
  const normalizedQuestion = normalizeForSearch(question);
  const asciiAnchors = tokenizeMeaningful(normalizedQuestion).filter(
    (token) =>
      /^[a-z0-9]+$/.test(token) &&
      !GENERIC_CONTEXT_TOKENS.has(token),
  );

  if (!CJK_CHARACTER_PATTERN.test(normalizedQuestion)) {
    return asciiAnchors;
  }

  const compactQuestion = normalizedQuestion.replace(/\s+/g, "");
  const anchorText = compactQuestion.replace(
    CJK_DIRECT_EVIDENCE_QUESTION_NOISE,
    " ",
  );
  const cjkAnchors = anchorText.match(
    /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,}/g,
  ) ?? [];
  const dateAnchors = anchorText.match(
    /\d{1,4}年(?:\d{1,2}月)?(?:\d{1,2}[日号])?/g,
  ) ?? [];

  return [...new Set([...asciiAnchors, ...cjkAnchors, ...dateAnchors])];
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

export function detectChineseRetrievalIntent(
  question: string,
): ChineseRetrievalIntent | null {
  const compactQuestion = normalizeForSearch(question).replace(/\s+/g, "");
  if (!CJK_CHARACTER_PATTERN.test(compactQuestion)) {
    return null;
  }
  if (isTranscriptOverviewQuestion(question)) {
    return "summary-or-overview";
  }
  if (/(?:多少|几(?:个|项|人|次|条|份)?|数量|总数)/.test(compactQuestion)) {
    return "quantity";
  }
  if (/(?:为什么|为何|原因|怎么会|因为什么)/.test(compactQuestion)) {
    return "reason-or-cause";
  }
  if (/(?:哪里|哪儿|何处|位置|存储在哪|保存在哪|放在哪)/.test(compactQuestion)) {
    return "location";
  }
  if (/(?:什么时候|何时|哪天|日期|时间|截止|期限|多久)/.test(compactQuestion)) {
    return "time-or-date";
  }
  if (/(?:谁负责|负责人|由谁|分配给谁|指派给谁|谁来(?:完成|处理|开发))/.test(compactQuestion)) {
    return "responsibility";
  }
  if (/(?:谁|哪位|何人).*(?:创建|开发|设计|编写|发明|制作)/.test(compactQuestion)) {
    return "creator-or-authorship";
  }
  if (/(?:叫什么|名称|名字|标题|名为)/.test(compactQuestion)) {
    return "name-or-identity";
  }
  if (/(?:怎么|如何).*(?:操作|使用|运行|执行|输入|设置|安装|打开|保存|步骤|命令)/.test(compactQuestion)) {
    return "command-or-procedure";
  }
  if (/(?:能做什么|可以做什么|能够做什么|(?:要|在)?(?:干|做)(?:什么|啥)|能否|是否可以|支不支持)/.test(compactQuestion)) {
    return "capability-or-action";
  }
  if (/(?:用途|目的|用来|用于|为了什么|有什么用)/.test(compactQuestion)) {
    return "purpose-or-utility";
  }
  return null;
}

export function detectChineseFollowUpReason(
  question: string,
): ChineseFollowUpReason | null {
  const compactQuestion = normalizeForSearch(question).replace(/\s+/g, "");
  if (!CJK_CHARACTER_PATTERN.test(compactQuestion)) {
    return null;
  }
  if (/[他她它](?:们)?(?:是|的|在|会|要|有|负责|什么|哪|何|怎|为|时)/.test(compactQuestion)) {
    return "pronoun";
  }
  if (/(?:这个|那个|这些|那些|这件事|那件事|前者|后者)/.test(compactQuestion)) {
    return "demonstrative";
  }
  if (/(?:同一个|上一个|前一个|之前的|刚才的|第一个|第二个|那个日期|那个人|那个项目)/.test(compactQuestion)) {
    return "referential-phrase";
  }
  if (/^(?:然后|还有|另外|接着|再说|那|那么)/.test(compactQuestion)) {
    return "ellipsis";
  }
  return null;
}

export function detectChineseQuestionKind(
  question: string,
): "yes-no" | "value" | "reason" | null {
  const compactQuestion = normalizeForSearch(question).replace(/\s+/g, "");
  if (!CJK_CHARACTER_PATTERN.test(compactQuestion)) {
    return null;
  }
  if (/(?:为什么|为何|原因)/.test(compactQuestion)) {
    return "reason";
  }
  if (
    /(?:吗|呢)[？?]?$/.test(compactQuestion) ||
    /^(?:是否|能否|有没有|是不是|可不可以)/.test(compactQuestion)
  ) {
    return "yes-no";
  }
  if (/(?:谁|什么|哪|何时|多少|几个|怎么|如何)/.test(compactQuestion)) {
    return "value";
  }
  return null;
}

export function isChineseMultiPartQuestion(question: string): boolean {
  const compactQuestion = normalizeForSearch(question).replace(/\s+/g, "");
  return (
    CJK_CHARACTER_PATTERN.test(compactQuestion) &&
    (/(?:以及|并且|同时|分别)/.test(compactQuestion) ||
      question.includes("；") ||
      (question.match(/[？?]/g)?.length ?? 0) > 1)
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
