import type { LlamaContext, RNLlamaOAICompatibleMessage } from "llama.rn";

import {
  ASK_AI_GROUNDING_REFUSAL,
  ASK_AI_GROUNDING_REFUSAL_ZH,
  TRANSCRIPT_TOO_LONG_ERROR,
} from "@/constants/ask-ai-grounding-policy";
import { ASK_AI_PROMPT_BUDGET } from "@/constants/ask-ai-inference-config";
import { InferenceError } from "@/errors/inference-error";

import type { TranscriptContextBlock } from "./ask-ai-grounded-messages";
import {
  resolveSelectedEvidenceStatus,
  type EvidenceDecisionGuard,
  type EvidenceStatus,
} from "./ask-ai-evidence-decision";
import {
  chunkTranscriptText,
  detectChineseFollowUpReason,
  detectChineseQuestionKind,
  detectChineseRetrievalIntent,
  hasDirectEvidenceTokenCoverage,
  hasUnmatchedDirectEvidenceAnchor,
  isTranscriptOverviewQuestion,
  isChineseMultiPartQuestion,
  normalizeEvidenceText,
  normalizeForSearch,
  stemToken,
  tokenizeMeaningful,
} from "./ask-ai-evidence-text";
import { countFormattedPromptTokens } from "./llm-context-budget";

const SUPPORTED_FINAL_ANSWER_POLICY = `You are answering a question that has already been verified as supported.

Answer the CURRENT USER QUESTION using only the VERIFIED TRANSCRIPT EVIDENCE.

Rules:
- Use no outside or pretrained factual knowledge.
- Answer in the same language as the CURRENT USER QUESTION.
- Answer directly and concisely.
- Preserve names, dates, numbers, uncertainty, and negation.
- For a summary or overview, include every distinct stated date, participant, event, and topic.
- Do not invent missing facts.
- Do not add names, products, commands, numbers, dates, places, organisations, technical terms, or factual claims that are not supported by VERIFIED TRANSCRIPT EVIDENCE.
- If the evidence directly contains the answer, prefer wording close to the evidence.
- Do not output the evidence itself unless the user asks for quotations or a list.`;

const MAX_CANDIDATES = 5;
const MAX_CANDIDATES_WITH_TIE = 6;
const MAX_OVERVIEW_CANDIDATES = 3;
const COMMON_SENTENCE_STARTERS = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
]);
const YES_NO_AUXILIARY_TOKENS = new Set([
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "can",
  "could",
  "will",
  "would",
  "should",
]);

type ChatHistoryMessage = {
  role: string;
  content: string;
};

export type EvidenceExtractionPrompt = {
  messages: RNLlamaOAICompatibleMessage[];
  promptTokenCount: number;
  historyTrimmed: boolean;
  evidenceChunks: EvidenceChunk[];
  extractionContext: EvidenceExtractionContext;
  retrievalCandidates: ScoredEvidenceChunk[];
  selectedEvidenceCandidates: ScoredEvidenceChunk[];
  questionKind: QuestionKind;
  relationIntent: RetrievalIntent;
  deterministicGuard: DeterministicGuard;
  decisionPrompts: EvidenceDecisionPrompt[];
  queryAnalysis: QueryAnalysis;
  followUp: FollowUpAnalysis;
  evidenceCoveragePartial: boolean;
};

export type VerifiedEvidenceResult = {
  status: EvidenceStatus;
  verifiedEvidence: string[];
  parsedEvidenceIds: string[];
  verifiedEvidenceIds: string[];
};

export type EvidenceChunk = {
  id: string;
  text: string;
};

export type ScoredEvidenceChunk = EvidenceChunk & {
  score: number;
};

export type RetrievalIntent =
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
  | "summary-or-overview"
  | "general";

export type QuestionKind =
  | "yes-no"
  | "value"
  | "reason"
  | "multi-part"
  | "other";
export type AnswerType =
  | "person"
  | "identity"
  | "time-date"
  | "location"
  | "quantity"
  | "instruction"
  | "reason"
  | "proposition"
  | "description";
export type DeterministicGuard = EvidenceDecisionGuard;

export type QueryAnalysis = {
  kind: QuestionKind;
  relation: RetrievalIntent;
  expectedAnswer: AnswerType;
  isMultiPart: boolean;
};

export type FollowUpAnalysis = {
  usesPreviousUser: boolean;
  reason: "pronoun" | "ellipsis" | "demonstrative" | "referential-phrase" | "none";
};

export type EvidenceDecisionPrompt = {
  question: string;
  selectedEvidenceCandidates: ScoredEvidenceChunk[];
  questionKind: QuestionKind;
  relationIntent: RetrievalIntent;
  deterministicGuard: DeterministicGuard;
  queryAnalysis: QueryAnalysis;
  followUp: FollowUpAnalysis;
  anchorCompatibility: CandidateEvaluation | null;
};

export type CandidateEvaluation = {
  candidate: ScoredEvidenceChunk;
  lexicalScore: number;
  currentTopicScore: number;
  relationScore: number;
  answerShapeScore: number;
  followUpScore: number;
  compatible: boolean;
};

type EvidenceSelection = {
  selectedEvidenceCandidates: ScoredEvidenceChunk[];
  anchorCompatibility: CandidateEvaluation | null;
};

type EvidenceExtractionContext = {
  previousUserQuestion: string;
  previousTurn: string;
  currentQuestion: string;
};

export function getGroundingRefusal(question: string = ""): string {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(question)
    ? ASK_AI_GROUNDING_REFUSAL_ZH
    : ASK_AI_GROUNDING_REFUSAL;
}

export function getAskAiMetaResponse(history: ChatHistoryMessage[]): string | null {
  const question = normalizeEvidenceText(history.at(-1)?.content ?? "")
    .toLowerCase()
    .replace(/[?!.]+$/g, "");

  if (question.length === 0) {
    return null;
  }

  const isGreeting =
    /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)\b/.test(
      question,
    );
  const isPermission =
    /\b(can|may)\s+i\s+ask\b/.test(question) ||
    /\bcan\s+we\s+(talk|chat)\b/.test(question);
  const isCapability =
    question === "what can you do" ||
    question === "what can i ask you" ||
    question === "what questions can i ask";

  if (isGreeting || isPermission || isCapability) {
    return "Yes. You can ask me questions about the selected transcript.";
  }

  return null;
}

export async function fitEvidenceExtractionMessagesToBudget(
  context: LlamaContext,
  transcriptBlocks: TranscriptContextBlock[],
  history: ChatHistoryMessage[],
  promptBudget: number = ASK_AI_PROMPT_BUDGET,
): Promise<EvidenceExtractionPrompt> {
  const allEvidenceChunks = buildEvidenceChunks(transcriptBlocks);
  const extractionContext = buildEvidenceExtractionContext(history);
  const retrievalCandidates = rankEvidenceCandidates(
    allEvidenceChunks,
    extractionContext,
  );
  const queryAnalysis = analyzeQuery(extractionContext.currentQuestion);
  const followUp = analyzeFollowUpNeed(extractionContext.currentQuestion);
  const decisionPrompts = buildEvidenceDecisionPrompts(
    allEvidenceChunks,
    extractionContext,
    retrievalCandidates,
    queryAnalysis,
  );
  const selectedEvidenceCandidates = unionSelectedEvidenceCandidates(
    decisionPrompts.flatMap((decision) => decision.selectedEvidenceCandidates),
  );
  const selectedEvidenceChunks = selectedEvidenceCandidates.map(({ id, text }) => ({
    id,
    text,
  }));
  // This legacy prompt snapshot is used only for budget accounting; evidence
  // decisions retain their own complete targeted candidates below. Bounding
  // the snapshot prevents a many-clause question from failing before its
  // individually small answer prompts can run.
  const budgetEvidenceChunks = selectedEvidenceChunks.slice(0, MAX_OVERVIEW_CANDIDATES);
  const firstDecision = decisionPrompts.at(0);
  const evidenceCoveragePartial =
    queryAnalysis.relation === "summary-or-overview" &&
    selectedEvidenceChunks.length < allEvidenceChunks.length;
  return fitEvidenceMessagesToBudget(
    context,
    history,
    (trimmedHistory) =>
      buildEvidenceBudgetMessages(
        budgetEvidenceChunks,
        buildEvidenceExtractionContext(trimmedHistory),
      ),
    promptBudget,
    budgetEvidenceChunks,
    extractionContext,
    retrievalCandidates,
    selectedEvidenceCandidates,
    queryAnalysis.kind,
    queryAnalysis.relation,
    firstDecision?.deterministicGuard ?? "selected-evidence-present",
    decisionPrompts,
    queryAnalysis,
    followUp,
    evidenceCoveragePartial,
  );
}

export async function fitVerifiedAnswerMessagesToBudget(
  context: LlamaContext,
  verifiedEvidence: string[],
  currentQuestion: string,
  promptBudget: number = ASK_AI_PROMPT_BUDGET,
  constrainedRetry: boolean = false,
): Promise<EvidenceExtractionPrompt> {
  if (verifiedEvidence.length === 0) {
    throw new InferenceError("Verified transcript evidence is required.");
  }

  const messages = buildVerifiedAnswerMessages(
    verifiedEvidence,
    currentQuestion,
    constrainedRetry,
  );
  const promptTokenCount = await countFormattedPromptTokens(context, messages);

  if (promptTokenCount > promptBudget) {
    throw new InferenceError(TRANSCRIPT_TOO_LONG_ERROR);
  }

  return {
    messages,
    promptTokenCount,
    historyTrimmed: false,
    evidenceChunks: [],
    extractionContext: {
      previousUserQuestion: "",
      previousTurn: "(none)",
      currentQuestion,
    },
    retrievalCandidates: [],
    selectedEvidenceCandidates: [],
    questionKind: analyzeQuery(currentQuestion).kind,
    relationIntent: analyzeQuery(currentQuestion).relation,
    deterministicGuard: "selected-evidence-present",
    decisionPrompts: [],
    queryAnalysis: analyzeQuery(currentQuestion),
    followUp: analyzeFollowUpNeed(currentQuestion),
    evidenceCoveragePartial: false,
  };
}

export function resolveSelectedEvidence(
  selectedEvidenceCandidates: ScoredEvidenceChunk[],
  deterministicGuard: DeterministicGuard,
): VerifiedEvidenceResult {
  const selectedEvidence = selectedEvidenceCandidates.map(
    (candidate) => candidate.text,
  );
  const selectedEvidenceIds = selectedEvidenceCandidates.map(
    (candidate) => candidate.id,
  );
  const status = resolveSelectedEvidenceStatus(
    deterministicGuard,
    selectedEvidence.length,
  );

  return {
    status,
    verifiedEvidence: selectedEvidence,
    parsedEvidenceIds: [],
    verifiedEvidenceIds: selectedEvidenceIds,
  };
}

function buildEvidenceBudgetMessages(
  evidenceChunks: EvidenceChunk[],
  extractionContext: EvidenceExtractionContext,
): RNLlamaOAICompatibleMessage[] {
  return buildVerifiedAnswerMessages(
    evidenceChunks.map((chunk) => chunk.text),
    extractionContext.currentQuestion,
  );
}

function buildVerifiedAnswerMessages(
  verifiedEvidence: string[],
  currentQuestion: string,
  constrainedRetry: boolean = false,
): RNLlamaOAICompatibleMessage[] {
  return [
    {
      role: "system",
      content: [
        SUPPORTED_FINAL_ANSWER_POLICY,
        "",
        "--- VERIFIED TRANSCRIPT EVIDENCE ---",
        verifiedEvidence.map((evidence) => `- ${evidence}`).join("\n"),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Answer the current user question using only the verified evidence.",
        constrainedRetry
          ? "Return a short answer using only information explicitly present in VERIFIED TRANSCRIPT EVIDENCE. Prefer copying the exact factual value or sentence fragment from the evidence. For a summary or overview, include every stated date, participant, event, and topic. Do not add outside facts. Do not refuse; this question has already been classified as supported."
          : "",
        "",
        "--- CURRENT USER QUESTION ---",
        currentQuestion,
      ].join("\n"),
    },
  ];
}

async function fitEvidenceMessagesToBudget(
  context: LlamaContext,
  history: ChatHistoryMessage[],
  buildMessages: (
    trimmedHistory: ChatHistoryMessage[],
  ) => RNLlamaOAICompatibleMessage[],
  promptBudget: number,
  evidenceChunks: EvidenceChunk[] = [],
  extractionContext: EvidenceExtractionContext = {
    previousUserQuestion: "",
    previousTurn: "(none)",
    currentQuestion: history.at(-1)?.content ?? "",
  },
  retrievalCandidates: ScoredEvidenceChunk[] = [],
  selectedEvidenceCandidates: ScoredEvidenceChunk[] = [],
  questionKind: QuestionKind = "other",
  relationIntent: RetrievalIntent = "general",
  deterministicGuard: DeterministicGuard = "selected-evidence-present",
  decisionPrompts: EvidenceDecisionPrompt[] = [],
  queryAnalysis: QueryAnalysis = {
    kind: "other",
    relation: "general",
    expectedAnswer: "description",
    isMultiPart: false,
  },
  followUp: FollowUpAnalysis = {
    usesPreviousUser: false,
    reason: "none",
  },
  evidenceCoveragePartial: boolean = false,
): Promise<EvidenceExtractionPrompt> {
  if (history.length === 0) {
    throw new InferenceError("Conversation history is empty.");
  }

  let trimmedHistory = [...history];
  let historyTrimmed = false;

  while (true) {
    const messages = buildMessages(trimmedHistory);
    const promptTokenCount = await countFormattedPromptTokens(context, messages);

    if (promptTokenCount <= promptBudget) {
      return {
        messages,
        promptTokenCount,
        historyTrimmed,
        evidenceChunks,
        extractionContext,
        retrievalCandidates,
        selectedEvidenceCandidates,
        questionKind,
        relationIntent,
        deterministicGuard,
        decisionPrompts,
        queryAnalysis,
        followUp,
        evidenceCoveragePartial,
      };
    }

    if (trimmedHistory.length <= 1) {
      throw new InferenceError(TRANSCRIPT_TOO_LONG_ERROR);
    }

    trimmedHistory = trimOldestConversationTurn(trimmedHistory);
    historyTrimmed = true;
  }
}

function trimOldestConversationTurn(
  history: ChatHistoryMessage[],
): ChatHistoryMessage[] {
  if (history.length <= 1) {
    return history;
  }

  const removeCount =
    history[0]?.role === "user" && history[1]?.role === "assistant" ? 2 : 1;
  let trimmed = history.slice(removeCount);

  while (trimmed.length > 1 && trimmed[0]?.role === "assistant") {
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}

function buildEvidenceExtractionContext(
  history: ChatHistoryMessage[],
): EvidenceExtractionContext {
  const currentQuestion = history.at(-1)?.content ?? "";
  const previousMessages = history.slice(0, -1);
  const previousAssistantIndex = findLastRoleIndex(
    previousMessages,
    "assistant",
  );

  if (previousAssistantIndex !== -1) {
    const previousUserIndex = findLastRoleIndex(
      previousMessages.slice(0, previousAssistantIndex),
      "user",
    );
    if (previousUserIndex !== -1) {
      const previousUserQuestion =
        previousMessages[previousUserIndex]?.content ?? "";
      return {
        previousUserQuestion,
        previousTurn: [
          "USER:",
          previousUserQuestion,
          "",
          "ASSISTANT:",
          previousMessages[previousAssistantIndex]?.content ?? "",
        ].join("\n"),
        currentQuestion,
      };
    }
  }

  const previousUserIndex = findLastRoleIndex(previousMessages, "user");
  const previousUserQuestion =
    previousUserIndex === -1
      ? ""
      : (previousMessages[previousUserIndex]?.content ?? "");
  return {
    previousUserQuestion,
    previousTurn:
      previousUserIndex === -1
        ? "(none)"
        : ["USER:", previousUserQuestion].join("\n"),
    currentQuestion,
  };
}

function findLastRoleIndex(
  history: ChatHistoryMessage[],
  role: string,
): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === role) {
      return index;
    }
  }
  return -1;
}

function isMultiPartQuestion(question: string): boolean {
  const normalizedQuestion = normalizeForSearch(question);
  return (
    isChineseMultiPartQuestion(question) ||
    normalizedQuestion.includes(" and ") ||
    normalizedQuestion.includes(" also ") ||
    question.includes(";") ||
    (question.match(/\?/g)?.length ?? 0) > 1
  );
}

function buildEvidenceDecisionPrompts(
  evidenceChunks: EvidenceChunk[],
  extractionContext: EvidenceExtractionContext,
  retrievalCandidates: ScoredEvidenceChunk[],
  queryAnalysis: QueryAnalysis,
): EvidenceDecisionPrompt[] {
  const decisionContexts =
    queryAnalysis.isMultiPart
      ? splitQuestionClauses(extractionContext.currentQuestion).map(
          (clause) => ({
            ...extractionContext,
            currentQuestion: clause,
          }),
        )
      : [extractionContext];
  const decisions: EvidenceDecisionPrompt[] = [];

  for (const decisionContext of decisionContexts) {
    const decisionAnalysis = analyzeQuery(decisionContext.currentQuestion);
    const decisionRetrievalCandidates =
      queryAnalysis.isMultiPart
        ? rankEvidenceCandidates(evidenceChunks, decisionContext)
        : retrievalCandidates;
    const selection = selectDeterministicEvidence(
      evidenceChunks,
      decisionRetrievalCandidates,
      decisionAnalysis,
      decisionContext.currentQuestion,
      analyzeFollowUpNeed(decisionContext.currentQuestion),
      decisionContext.previousUserQuestion,
    );
    const selectedEvidenceCandidates = selection.selectedEvidenceCandidates;
    const deterministicGuard = detectDeterministicGuard(
      decisionContext.currentQuestion,
      selectedEvidenceCandidates,
      decisionAnalysis,
    );
    decisions.push({
      question: decisionContext.currentQuestion,
      selectedEvidenceCandidates,
      questionKind: decisionAnalysis.kind,
      relationIntent: decisionAnalysis.relation,
      deterministicGuard,
      queryAnalysis: decisionAnalysis,
      followUp: analyzeFollowUpNeed(decisionContext.currentQuestion),
      anchorCompatibility: selection.anchorCompatibility,
    });
  }

  return decisions;
}

function unionSelectedEvidenceCandidates(
  candidates: ScoredEvidenceChunk[],
): ScoredEvidenceChunk[] {
  const selected = new Map<string, ScoredEvidenceChunk>();
  for (const candidate of candidates) {
    selected.set(candidate.id, candidate);
  }
  return [...selected.values()];
}

function selectDeterministicEvidence(
  evidenceChunks: EvidenceChunk[],
  retrievalCandidates: ScoredEvidenceChunk[],
  queryAnalysis: QueryAnalysis,
  currentQuestion: string,
  followUp: FollowUpAnalysis,
  previousUserQuestion: string,
): EvidenceSelection {
  const evaluations = retrievalCandidates
    .map((candidate) =>
      evaluateCandidate(
        candidate,
        queryAnalysis,
        currentQuestion,
        followUp,
        previousUserQuestion,
      ),
    )
    .filter((evaluation) => evaluation.compatible)
    .sort((left, right) => {
      const rightScore =
        right.lexicalScore +
        right.currentTopicScore +
        right.relationScore +
        right.answerShapeScore +
        right.followUpScore;
      const leftScore =
        left.lexicalScore +
        left.currentTopicScore +
        left.relationScore +
        left.answerShapeScore +
        left.followUpScore;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.candidate.score - left.candidate.score;
    });

  if (queryAnalysis.relation === "summary-or-overview") {
    return {
      selectedEvidenceCandidates: evaluations.map(
        (evaluation) => evaluation.candidate,
      ),
      anchorCompatibility: evaluations.at(0) ?? null,
    };
  }

  const anchorEvaluation = evaluations.at(0);
  if (anchorEvaluation === undefined) {
    return {
      selectedEvidenceCandidates: [],
      anchorCompatibility: null,
    };
  }

  const adjacentContext = selectAdjacentContext(
    evidenceChunks,
    anchorEvaluation.candidate,
    queryAnalysis,
  );
  return {
    selectedEvidenceCandidates: [anchorEvaluation.candidate, ...adjacentContext],
    anchorCompatibility: anchorEvaluation,
  };
}

function evaluateCandidate(
  candidate: ScoredEvidenceChunk,
  queryAnalysis: QueryAnalysis,
  currentQuestion: string,
  followUp: FollowUpAnalysis,
  previousUserQuestion: string,
): CandidateEvaluation {
  const currentTopicScore = scoreTopicOverlap(
    tokenizeMeaningful(currentQuestion),
    candidate.text,
  );
  const relationScore = isRelationCompatible(candidate.text, queryAnalysis)
    ? 1
    : 0;
  const answerShapeScore = hasExpectedAnswerShape(
    candidate.text,
    queryAnalysis,
  )
    ? 1
    : 0;
  const followUpScore = followUp.usesPreviousUser
    ? scoreTopicOverlap(
        tokenizeMeaningful(previousUserQuestion),
        candidate.text,
      )
    : 0;

  return {
    candidate,
    lexicalScore: candidate.score,
    currentTopicScore,
    relationScore,
    answerShapeScore,
    followUpScore,
    compatible:
      relationScore > 0 &&
      (queryAnalysis.relation === "summary-or-overview" ||
        currentTopicScore > 0),
  };
}

function scoreTopicOverlap(tokens: string[], evidenceText: string): number {
  const evidenceTokens = new Set(tokenizeMeaningful(evidenceText));
  return [...new Set(tokens)].filter((token) => evidenceTokens.has(token)).length;
}

function hasExpectedAnswerShape(
  evidenceText: string,
  queryAnalysis: QueryAnalysis,
): boolean {
  const normalizedEvidence = normalizeForSearch(evidenceText);

  switch (queryAnalysis.expectedAnswer) {
    case "time-date":
      return hasTimeDateRelation(normalizedEvidence);
    case "quantity":
      return hasQuantityRelation(normalizedEvidence);
    case "instruction":
      return hasInstructionRelation(normalizedEvidence);
    case "reason":
      return hasReasonRelation(normalizedEvidence);
    case "identity":
      return hasIdentityRelation(evidenceText, normalizedEvidence);
    case "location":
      return hasLocationRelation(normalizedEvidence);
    case "person":
      return (
        hasMultiWordProperNameLikePhrase(evidenceText) ||
        /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,4}/.test(evidenceText)
      );
    case "proposition":
    case "description":
      return true;
  }
}

function isRelationCompatible(
  evidenceText: string,
  queryAnalysis: QueryAnalysis,
): boolean {
  const normalizedEvidence = normalizeForSearch(evidenceText);
  const evidenceTokens = new Set(tokenizeMeaningful(evidenceText));

  switch (queryAnalysis.relation) {
    case "name-or-identity":
      return hasIdentityRelation(evidenceText, normalizedEvidence);
    case "responsibility":
      return hasResponsibilityRelation(normalizedEvidence);
    case "purpose-or-utility":
      return hasPurposeRelation(normalizedEvidence);
    case "capability-or-action":
      return (
        hasCapabilityRelation(normalizedEvidence, evidenceTokens) ||
        hasResponsibilityRelation(normalizedEvidence)
      );
    case "time-or-date":
      return hasTimeDateRelation(normalizedEvidence);
    case "reason-or-cause":
      return hasReasonRelation(normalizedEvidence);
    case "command-or-procedure":
      return hasInstructionRelation(normalizedEvidence);
    case "creator-or-authorship":
      return containsCreatorRelationLanguage(normalizedEvidence);
    case "location":
      return hasLocationRelation(normalizedEvidence);
    case "quantity":
      return hasQuantityRelation(normalizedEvidence);
    case "summary-or-overview":
    case "general":
      return true;
  }
}

function hasIdentityRelation(
  evidenceText: string,
  normalizedEvidence: string,
): boolean {
  return (
    /\b(is|are|was|were|called|named|known as|titled|logged in as)\b/.test(
      normalizedEvidence,
    ) ||
    /(?:是|叫|名为|名称(?:是|为)|标题(?:是|为))/.test(normalizedEvidence) ||
    hasMultiWordProperNameLikePhrase(evidenceText)
  );
}

function hasCapabilityRelation(
  normalizedEvidence: string,
  evidenceTokens: Set<string>,
): boolean {
  return (
    (/\b(can|could|allows?|lets?|supports?)\b/.test(normalizedEvidence) ||
      /\bable\s+to\b/.test(normalizedEvidence) ||
      /(?:可以|能够|支持|允许)/.test(normalizedEvidence)) &&
    hasActionMarker(normalizedEvidence, evidenceTokens)
  );
}

function hasActionMarker(
  normalizedEvidence: string,
  evidenceTokens: Set<string>,
): boolean {
  return (
    /\b(use|open|tap|press|drag|move|select|choose|send|save|access|perform|run|execute|enter|type)\b/.test(
      normalizedEvidence,
    ) ||
    /(?:使用|打开|点击|按下|拖动|移动|选择|发送|保存|访问|运行|执行|输入|设置|安装|完成|处理|开发)/.test(
      normalizedEvidence,
    ) ||
    evidenceTokens.has("action")
  );
}

function hasTimeDateRelation(normalizedEvidence: string): boolean {
  return (
    /\b(deadline|due|scheduled|schedule|date|time|by|before|after|during|morning|afternoon|evening|tonight|tomorrow|today)\b/.test(
      normalizedEvidence,
    ) ||
    /(?:截止|期限|日期|时间|计划|安排|今天|明天|后天|上午|下午|晚上|星期|周[一二三四五六日天]|\d{1,4}年|\d{1,2}月|\d{1,2}[日号点时分])/.test(
      normalizedEvidence,
    ) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/.test(normalizedEvidence) ||
    /\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b/.test(normalizedEvidence)
  );
}

function hasResponsibilityRelation(normalizedEvidence: string): boolean {
  return (
    /\b(responsible for|assigned to|handles?|tasked with|role is|works on|working on)\b/.test(
      normalizedEvidence,
    ) || /(?:负责|负责人|分工|指派|分配|承担|交给|由.+(?:完成|处理|开发))/.test(normalizedEvidence)
  );
}

function hasPurposeRelation(normalizedEvidence: string): boolean {
  return (
    /\b(used for|useful for|purpose|goal|helps?|allows?|lets?|enables?|so that|in order to|good way to)\b/.test(
      normalizedEvidence,
    ) || /(?:用于|用来|用途|目的是|目标是|为了|以便)/.test(normalizedEvidence)
  );
}

function hasReasonRelation(normalizedEvidence: string): boolean {
  return (
    /\b(because|because of|due to|reason|causes?|since|therefore|as a result)\b/.test(
      normalizedEvidence,
    ) || /(?:因为|由于|原因|所以|因此|从而)/.test(normalizedEvidence)
  );
}

function hasInstructionRelation(normalizedEvidence: string): boolean {
  return (
    /\b(type|run|execute|enter|use|invoke|open|tap|press|select|choose|save)\b\s+\S+/.test(
      normalizedEvidence,
    ) || /(?:输入|运行|执行|使用|打开|点击|按下|选择|保存|安装|设置).+/.test(normalizedEvidence)
  );
}

function hasLocationRelation(normalizedEvidence: string): boolean {
  return (
    /\b(located|stored|saved|kept|inside|at)\b/.test(normalizedEvidence) ||
    /(?:位于|存储在|保存在|放在|路径|位置|里面)/.test(normalizedEvidence)
  );
}

function hasQuantityRelation(normalizedEvidence: string): boolean {
  return (
    /\b\d+|one|two|three|four|five|several|many|few|multiple\b/.test(
      normalizedEvidence,
    ) || /(?:\d+|[一二三四五六七八九十百两几多]+)(?:个|项|人|次|条|份|天|周|月|年)/.test(normalizedEvidence)
  );
}

function selectAdjacentContext(
  evidenceChunks: EvidenceChunk[],
  anchor: ScoredEvidenceChunk,
  queryAnalysis: QueryAnalysis,
): ScoredEvidenceChunk[] {
  const anchorIndex = evidenceChunks.findIndex((chunk) => chunk.id === anchor.id);
  if (anchorIndex === -1) {
    return [];
  }

  const previousChunk = evidenceChunks[anchorIndex - 1];
  const nextChunk = evidenceChunks[anchorIndex + 1];
  if (
    previousChunk !== undefined &&
    startsWithDependentDiscourse(anchor.text)
  ) {
    return [{ ...previousChunk, score: anchor.score }];
  }

  if (
    nextChunk !== undefined &&
    continuesRelation(anchor.text, nextChunk.text, queryAnalysis)
  ) {
    return [{ ...nextChunk, score: anchor.score }];
  }

  return [];
}

function startsWithDependentDiscourse(text: string): boolean {
  return /^(this|that|it|these|those|because|therefore|so|as a result|which|such)\b/i.test(
    text.trim(),
  );
}

function continuesRelation(
  anchorText: string,
  candidateText: string,
  queryAnalysis: QueryAnalysis,
): boolean {
  if (startsWithDependentDiscourse(candidateText)) {
    return true;
  }
  return isRelationCompatible(candidateText, queryAnalysis) &&
    sharesTopicToken(anchorText, candidateText);
}

function sharesTopicToken(leftText: string, rightText: string): boolean {
  const leftTokens = new Set(tokenizeMeaningful(leftText));
  return tokenizeMeaningful(rightText).some((token) => leftTokens.has(token));
}

function splitQuestionClauses(question: string): string[] {
  return normalizeQuestionClauses(question)
    .split(/,?\s+\b(?:and|also|plus)\b|(?:以及|并且|同时)|[;；]/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeQuestionClauses(question: string): string {
  return question.replace(/\?/g, " ? ");
}

function analyzeQuery(question: string): QueryAnalysis {
  const normalizedQuestion = normalizeForSearch(question);
  const isMultiPart = isMultiPartQuestion(question);
  const chineseKind = detectChineseQuestionKind(question);
  const firstToken = normalizedQuestion.split(" ")[0] ?? "";
  const startsWithAuxiliary =
    /^(is|are|was|were|do|does|did|has|have|had|can|could|will|would|should)$/.test(
      firstToken,
    );
  const relation = detectRetrievalIntent(question, normalizedQuestion, firstToken);
  const kind: QuestionKind = isMultiPart
    ? "multi-part"
    : chineseKind !== null
      ? chineseKind
    : firstToken === "why"
      ? "reason"
      : startsWithAuxiliary
        ? "yes-no"
        : /^(what|which|who|when|where|how)$/.test(firstToken)
          ? "value"
          : "other";

  return {
    kind,
    relation,
    expectedAnswer: detectExpectedAnswerType(firstToken, normalizedQuestion, relation),
    isMultiPart,
  };
}

function detectExpectedAnswerType(
  firstToken: string,
  normalizedQuestion: string,
  relation: RetrievalIntent,
): AnswerType {
  if (/(?:谁|哪位|何人)/.test(normalizedQuestion)) {
    return "person";
  }
  if (relation === "command-or-procedure") {
    return "instruction";
  }
  if (relation === "reason-or-cause" || firstToken === "why") {
    return "reason";
  }
  if (firstToken === "who") {
    return "person";
  }
  if (relation === "time-or-date" || firstToken === "when") {
    return "time-date";
  }
  if (relation === "location" || firstToken === "where") {
    return "location";
  }
  if (relation === "quantity" || /^how (many|much)\b/.test(normalizedQuestion)) {
    return "quantity";
  }
  if (
    relation === "name-or-identity" ||
    /\b(name|called|named|identifier|account|username)\b/.test(normalizedQuestion)
  ) {
    return "identity";
  }
  if (
    /^(is|are|was|were|do|does|did|has|have|had|can|could|will|would|should)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "proposition";
  }
  return "description";
}

function detectDeterministicGuard(
  currentQuestion: string,
  selectedEvidenceCandidates: ScoredEvidenceChunk[],
  queryAnalysis: QueryAnalysis,
): DeterministicGuard {
  const selectedEvidence = selectedEvidenceCandidates.map(
    (candidate) => candidate.text,
  );
  const normalizedEvidence = normalizeForSearch(selectedEvidence.join(" "));

  if (selectedEvidenceCandidates.length === 0) {
    return "relation-mismatch";
  }

  if (queryAnalysis.relation === "summary-or-overview") {
    return "overview-context-present";
  }

  if (
    queryAnalysis.relation === "creator-or-authorship" &&
    !containsCreatorRelationLanguage(normalizedEvidence)
  ) {
    return "relation-mismatch";
  }

  if (queryAnalysis.kind === "yes-no") {
    if (containsMetaMissingLanguage(normalizedEvidence)) {
      return "meta-missing";
    }

    if (hasExplicitYesNoEvidence(currentQuestion, normalizedEvidence)) {
      return "yes-no-explicit-support";
    }
  }

  if (
    queryAnalysis.kind === "value" &&
    containsMetaMissingLanguage(normalizedEvidence)
  ) {
    return "meta-missing";
  }

  if (
    queryAnalysis.kind === "value" &&
    queryAnalysis.relation !== "general" &&
    hasUnmatchedDirectEvidenceAnchor(currentQuestion, selectedEvidence)
  ) {
    return "relation-mismatch";
  }

  if (
    hasDirectEvidenceMatch(
      currentQuestion,
      selectedEvidence,
      queryAnalysis,
    )
  ) {
    return "direct-evidence-match";
  }

  return "selected-evidence-present";
}

/**
 * Mark a conservative exact-match case for diagnostics: every meaningful
 * question token is present in relation-compatible evidence with the expected
 * answer shape. Discriminating tokens such as Android versus iOS still matter.
 */
export function hasDirectEvidenceMatch(
  currentQuestion: string,
  selectedEvidence: string[],
  queryAnalysis: QueryAnalysis,
): boolean {
  if (
    queryAnalysis.kind !== "value" ||
    queryAnalysis.relation === "general" ||
    queryAnalysis.relation === "summary-or-overview"
  ) {
    return false;
  }

  if (!hasDirectEvidenceTokenCoverage(currentQuestion, selectedEvidence)) {
    return false;
  }

  return selectedEvidence.some(
    (evidence) =>
      isRelationCompatible(evidence, queryAnalysis) &&
      hasExpectedAnswerShape(evidence, queryAnalysis),
  );
}

function containsCreatorRelationLanguage(normalizedEvidence: string): boolean {
  return (
    /\b(invent|invented|inventor|create|created|creator|design|designed|develop|developed|make|made|build|built|found|founded)\b/.test(
      normalizedEvidence,
    ) || /(?:创建|开发|设计|编写|发明|制作|构建)/.test(normalizedEvidence)
  );
}

function hasExplicitYesNoEvidence(
  currentQuestion: string,
  normalizedEvidence: string,
): boolean {
  if (!containsPropositionNegation(normalizedEvidence)) {
    return false;
  }

  const questionTokens = tokenizeMeaningful(currentQuestion).filter(
    (token) => !YES_NO_AUXILIARY_TOKENS.has(token),
  );
  if (questionTokens.length === 0) {
    return false;
  }

  const evidenceTokens = new Set(tokenizeMeaningful(normalizedEvidence));
  const overlapCount = questionTokens.filter((token) =>
    evidenceTokens.has(token),
  ).length;
  return overlapCount >= Math.min(2, questionTokens.length);
}

function containsPropositionNegation(normalizedEvidence: string): boolean {
  return /\b(has not|have not|had not|did not|does not|do not|is not|are not|was not|were not|not yet|never|no)\b/.test(
    normalizedEvidence,
  );
}

function containsMetaMissingLanguage(normalizedEvidence: string): boolean {
  return (
    /\bno\s+(information|info|details?|data)\b/.test(normalizedEvidence) ||
    /\bnot\s+(discussed|provided|available|mentioned|specified|stated)\b/.test(
      normalizedEvidence,
    ) ||
    /\bnot\s+available\b/.test(normalizedEvidence) ||
    /\bunknown|unavailable\b/.test(normalizedEvidence) ||
    /\bno\s+details?\b/.test(normalizedEvidence)
  );
}

function rankEvidenceCandidates(
  evidenceChunks: EvidenceChunk[],
  extractionContext: EvidenceExtractionContext,
): ScoredEvidenceChunk[] {
  const question = extractionContext.currentQuestion;
  const retrievalIntent = analyzeQuery(question).relation;
  if (retrievalIntent === "summary-or-overview") {
    return balancedOverviewCandidates(evidenceChunks).map((chunk) => ({ ...chunk, score: 1 }));
  }

  const followUp = analyzeFollowUpNeed(question);
  const excludedQuestionTokens = extractNegatedQuestionTokens(question);
  const questionTokens = tokenizeMeaningful(question).filter(
    (token) => !excludedQuestionTokens.has(token),
  );
  const previousTokens = followUp.usesPreviousUser
    ? tokenizeMeaningful(extractionContext.previousUserQuestion)
    : [];
  const targetEntityHints = detectTargetEntityHints(
    question,
    extractionContext.previousUserQuestion,
    followUp,
  );
  const questionPhrases = buildPhrases(questionTokens);

  const scored = evidenceChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreEvidenceChunk(
        chunk.text,
        question,
        questionTokens,
        previousTokens,
        questionPhrases,
        retrievalIntent,
        targetEntityHints,
      ),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id, undefined, { numeric: true });
    });

  if (scored.length <= MAX_CANDIDATES) {
    return scored;
  }

  const candidates = scored.slice(0, MAX_CANDIDATES);
  const tieScore = candidates.at(-1)?.score;
  if (tieScore === undefined) {
    return candidates;
  }

  for (
    let index = MAX_CANDIDATES;
    index < scored.length && candidates.length < MAX_CANDIDATES_WITH_TIE;
    index += 1
  ) {
    if (scored[index]?.score !== tieScore) {
      break;
    }
    candidates.push(scored[index]);
  }

  return candidates;
}

function balancedOverviewCandidates(evidenceChunks: EvidenceChunk[]): EvidenceChunk[] {
  if (evidenceChunks.length <= MAX_OVERVIEW_CANDIDATES) return evidenceChunks;
  const groups = new Map<string, EvidenceChunk[]>();
  for (const chunk of evidenceChunks) {
    const noteKey = chunk.id.match(/^(N\d+)-E\d+$/u)?.[1] ?? "N1";
    groups.set(noteKey, [...(groups.get(noteKey) ?? []), chunk]);
  }

  const orderedGroups = [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
  const base = Math.floor(MAX_OVERVIEW_CANDIDATES / orderedGroups.length);
  let remainder = MAX_OVERVIEW_CANDIDATES % orderedGroups.length;
  const sampledGroups = orderedGroups.map(([, chunks]) => {
    const allowance = Math.min(chunks.length, base + (remainder-- > 0 ? 1 : 0));
    return evenlySampleChunks(chunks, allowance);
  });
  const result: EvidenceChunk[] = [];
  for (let round = 0; result.length < MAX_OVERVIEW_CANDIDATES; round += 1) {
    let added = false;
    for (const group of sampledGroups) {
      const candidate = group[round];
      if (candidate) {
        result.push(candidate);
        added = true;
      }
    }
    if (!added) break;
  }
  return result;
}

function evenlySampleChunks(chunks: EvidenceChunk[], count: number): EvidenceChunk[] {
  if (count <= 0) return [];
  if (count >= chunks.length) return chunks;
  if (count === 1) return [chunks[0]];
  return Array.from({ length: count }, (_, index) =>
    chunks[Math.round(index * (chunks.length - 1) / (count - 1))],
  ).filter((chunk): chunk is EvidenceChunk => Boolean(chunk));
}

function scoreEvidenceChunk(
  chunkText: string,
  question: string,
  questionTokens: string[],
  previousTokens: string[],
  questionPhrases: string[],
  retrievalIntent: RetrievalIntent,
  targetEntityHints: Set<string>,
): number {
  const chunkTokens = new Set(tokenizeMeaningful(chunkText));
  const normalizedChunk = normalizeForSearch(chunkText);
  let score = 0;

  for (const token of new Set(questionTokens)) {
    if (chunkTokens.has(token)) {
      score += 5;
    }
  }

  for (const token of new Set(previousTokens)) {
    if (chunkTokens.has(token)) {
      score += 1.25;
    }
  }

  for (const phrase of questionPhrases) {
    if (normalizedChunk.includes(phrase)) {
      score += phrase.split(" ").length === 3 ? 10 : 7;
    }
  }

  score += scoreQuestionTypeBonus(
    question,
    chunkText,
    normalizedChunk,
    chunkTokens,
    retrievalIntent,
    targetEntityHints,
  );

  return score;
}

function scoreQuestionTypeBonus(
  question: string,
  chunkText: string,
  normalizedChunk: string,
  chunkTokens: Set<string>,
  retrievalIntent: RetrievalIntent,
  targetEntityHints: Set<string>,
): number {
  const normalizedQuestion = normalizeForSearch(question);
  let score = 0;

  if (retrievalIntent === "time-or-date" && hasTimeDateRelation(normalizedChunk)) {
    score += 7;
  }

  if (retrievalIntent === "responsibility") {
    if (/\bresponsib/.test(normalizedChunk)) {
      score += 7;
    }
  }

  if (/^(has|did|is|are|was|were|do|does|can)\b/.test(normalizedQuestion)) {
    if (
      /\b(no|not|never|unknown|undecided|decision|decided|discussed)\b/.test(
        normalizedChunk,
      )
    ) {
      score += 5;
    }
  }

  if (
    retrievalIntent === "reason-or-cause" &&
    /\b(because|because of|due to|reason|causes?|since|therefore|as a result)\b/.test(
      normalizedChunk,
    )
  ) {
    score += 8;
  }

  if (
    retrievalIntent === "command-or-procedure" &&
    /\b(type|run|execute|enter|use|invoke)\b\s+\S+/.test(normalizedChunk)
  ) {
    score += 8;
  }

  score += scoreRetrievalIntentBonus(
    retrievalIntent,
    chunkText,
    normalizedChunk,
    chunkTokens,
    targetEntityHints,
  );
  score += scoreExpectedAnswerShapeBonus(question, chunkText, normalizedChunk);

  return score;
}

function scoreExpectedAnswerShapeBonus(
  question: string,
  chunkText: string,
  normalizedChunk: string,
): number {
  const expectedAnswer = analyzeQuery(question).expectedAnswer;

  if (expectedAnswer === "time-date" && hasTimeDateRelation(normalizedChunk)) {
    return 3;
  }
  if (expectedAnswer === "quantity" && /\b\d+|one|two|three|several|many|few|multiple\b/.test(normalizedChunk)) {
    return 3;
  }
  if (
    expectedAnswer === "instruction" &&
    /\b(type|run|execute|enter|use|invoke)\b\s+\S+/.test(normalizedChunk)
  ) {
    return 3;
  }
  if (
    expectedAnswer === "reason" &&
    /\b(because|because of|due to|reason|causes?|since|therefore|as a result)\b/.test(
      normalizedChunk,
    )
  ) {
    return 3;
  }
  if (
    expectedAnswer === "person" &&
    hasMultiWordProperNameLikePhrase(chunkText)
  ) {
    return 2;
  }

  return 0;
}

function detectRetrievalIntent(
  question: string,
  normalizedQuestion: string,
  firstToken: string = normalizeForSearch(normalizedQuestion).split(" ")[0] ?? "",
): RetrievalIntent {
  if (isTranscriptOverviewQuestion(question)) {
    return "summary-or-overview";
  }

  const chineseIntent = detectChineseRetrievalIntent(question);
  if (chineseIntent !== null) {
    return chineseIntent;
  }

  if (/^how (many|much)\b/.test(normalizedQuestion)) {
    return "quantity";
  }

  if (firstToken === "why" || /\b(reason|cause|causes|because)\b/.test(normalizedQuestion)) {
    return "reason-or-cause";
  }

  if (firstToken === "where" || /\b(location|stored|located)\b/.test(normalizedQuestion)) {
    return "location";
  }

  if (
    /\b(command|type|enter|run|execute|invoke|command line|terminal)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "command-or-procedure";
  }

  if (/\b(name|called|named|title|titled|username|identifier|account|known as)\b/.test(normalizedQuestion)) {
    return "name-or-identity";
  }

  if (
    /\b(invent|invented|inventor|create|created|creator|author|authored|write|wrote|written|design|designed|develop|developed|make|made|build|built|found|founded)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "creator-or-authorship";
  }

  if (
    /\b(what can|can .* do|able to|how can .* use|actions? can|perform|allow|allows|let|lets|support|supports)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "capability-or-action";
  }

  if (firstToken === "when" || /\b(deadline|due|scheduled|schedule|time|date)\b/.test(normalizedQuestion)) {
    return "time-or-date";
  }

  if (
    /\b(responsib|responsibility|responsible|assigned|handles?|tasked|role)\b/.test(normalizedQuestion)
  ) {
    return "responsibility";
  }

  if (/\b(goal|purpose|objective|aim|used for|useful for|for)\b/.test(normalizedQuestion)) {
    return "purpose-or-utility";
  }

  return "general";
}

function detectTargetEntityHints(
  currentQuestion: string,
  previousUserQuestion: string,
  followUp: FollowUpAnalysis = analyzeFollowUpNeed(currentQuestion),
): Set<string> {
  const source = followUp.usesPreviousUser
    ? `${currentQuestion} ${previousUserQuestion}`
    : currentQuestion;
  const tokens = new Set(tokenizeMeaningful(source));
  const hints = new Set<string>();

  for (const token of tokens) {
    if (isArtifactEntityToken(token)) {
      hints.add(token);
    }
  }

  return hints;
}

function scoreRetrievalIntentBonus(
  retrievalIntent: RetrievalIntent,
  chunkText: string,
  normalizedChunk: string,
  chunkTokens: Set<string>,
  targetEntityHints: Set<string>,
): number {
  if (retrievalIntent === "name-or-identity") {
    return scoreNameIntentBonus(
      chunkText,
      normalizedChunk,
      chunkTokens,
      targetEntityHints,
    );
  }

  if (retrievalIntent === "capability-or-action") {
    return scoreCapabilityIntentBonus(normalizedChunk, chunkTokens);
  }

  return 0;
}

function scoreCapabilityIntentBonus(
  normalizedChunk: string,
  chunkTokens: Set<string>,
): number {
  const hasCapabilityStructure =
    /\b(can|could|allows?|lets?)\b/.test(normalizedChunk) ||
    /\bable\s+to\b/.test(normalizedChunk) ||
    /\bshould\s+be\s+able\s+to\b/.test(normalizedChunk);
  const hasActionMarker =
    /\b(use|open|tap|press|drag|move|select|choose|send|save|access|perform)\b/.test(
      normalizedChunk,
    );
  const hasUserSubject =
    chunkTokens.has("user") ||
    chunkTokens.has("people") ||
    chunkTokens.has("person");
  let score = 0;

  if (hasCapabilityStructure && hasActionMarker) {
    score += 25;
  }

  if (hasUserSubject && hasActionMarker) {
    score += 8;
  }

  if (hasActionMarker) {
    score += 5;
  }

  return score;
}

function scoreNameIntentBonus(
  chunkText: string,
  normalizedChunk: string,
  chunkTokens: Set<string>,
  targetEntityHints: Set<string>,
): number {
  const hasNamePattern =
    /\b(called|named|known as|titled)\b/.test(normalizedChunk) ||
    /\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){1,}\s+is\s+(a|an|the)\b/.test(
      chunkText,
    );
  const hasProperName = hasMultiWordProperNameLikePhrase(chunkText);
  const hasArtifactIdentity = hasArtifactIdentityToken(chunkTokens);
  const targetMatchesArtifact =
    targetEntityHints.size === 0 ||
    [...targetEntityHints].some((hint) =>
      artifactEntityTokensOverlap(hint, chunkTokens),
    );
  let score = 0;

  if (hasProperName && hasArtifactIdentity && targetMatchesArtifact) {
    score += 10;
  }

  if (hasNamePattern && targetMatchesArtifact) {
    score += hasArtifactIdentity ? 6 : 3;
  }

  if (hasProperName && hasArtifactIdentity && !targetMatchesArtifact) {
    score += 3;
  }

  return score;
}

function hasMultiWordProperNameLikePhrase(text: string): boolean {
  const matches = text.match(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)+\b/g);
  if (matches === null) {
    return false;
  }

  return matches.some((match) => {
    const words = match.split(/\s+/);
    const meaningfulWords = words.filter(
      (word, index) =>
        !(index === 0 && COMMON_SENTENCE_STARTERS.has(word.toLowerCase())),
    );
    return meaningfulWords.length >= 2;
  });
}

function hasArtifactIdentityToken(chunkTokens: Set<string>): boolean {
  return [...chunkTokens].some(isArtifactEntityToken);
}

function artifactEntityTokensOverlap(
  targetHint: string,
  chunkTokens: Set<string>,
): boolean {
  if (chunkTokens.has(targetHint)) {
    return true;
  }

  if (targetHint === "project") {
    return (
      chunkTokens.has("application") ||
      chunkTokens.has("app") ||
      chunkTokens.has("platform") ||
      chunkTokens.has("system") ||
      chunkTokens.has("product") ||
      chunkTokens.has("tool")
    );
  }

  return false;
}

function isArtifactEntityToken(token: string): boolean {
  return (
    token === "project" ||
    token === "application" ||
    token === "app" ||
    token === "platform" ||
    token === "system" ||
    token === "product" ||
    token === "tool"
  );
}

function analyzeFollowUpNeed(question: string): FollowUpAnalysis {
  const normalizedQuestion = normalizeForSearch(question);
  const chineseReason = detectChineseFollowUpReason(question);

  if (chineseReason !== null) {
    return { usesPreviousUser: true, reason: chineseReason };
  }

  if (/\b(he|she|they|it|him|her|them|his|hers|their|theirs|its)\b/.test(normalizedQuestion)) {
    return { usesPreviousUser: true, reason: "pronoun" };
  }

  if (/\b(this|that|these|those)\b/.test(normalizedQuestion)) {
    return { usesPreviousUser: true, reason: "demonstrative" };
  }

  if (
    /\b(the same|the previous|the first one|the second one|that deadline|that date|that model|that person|that project|that item)\b/.test(
      normalizedQuestion,
    )
  ) {
    return { usesPreviousUser: true, reason: "referential-phrase" };
  }

  if (/^(i mean|rather|instead|actually)\b/.test(normalizedQuestion)) {
    return { usesPreviousUser: true, reason: "ellipsis" };
  }

  if (
    /^(and|also|what about|how about|when|where|why|who|what|which)\b/.test(
      normalizedQuestion,
    ) &&
    normalizedQuestion.split(" ").length <= 5
  ) {
    return { usesPreviousUser: true, reason: "ellipsis" };
  }

  return { usesPreviousUser: false, reason: "none" };
}

function extractNegatedQuestionTokens(question: string): Set<string> {
  const tokens = normalizeForSearch(question).split(/\s+/);
  const excluded = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== "not") {
      continue;
    }

    for (
      let lookaheadIndex = index + 1;
      lookaheadIndex < Math.min(tokens.length, index + 4);
      lookaheadIndex += 1
    ) {
      const token = stemToken(tokens[lookaheadIndex] ?? "");
      if (token.length > 1 && tokenizeMeaningful(token).length > 0) {
        excluded.add(token);
      }
    }
  }

  return excluded;
}

function buildPhrases(tokens: string[]): string[] {
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  for (let index = 0; index < tokens.length - 2; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }
  return phrases;
}

function buildEvidenceChunks(
  transcriptBlocks: TranscriptContextBlock[],
): EvidenceChunk[] {
  const multipleNotes = transcriptBlocks.length > 1;
  return transcriptBlocks.flatMap((block, blockIndex) => {
    const chunkTexts = chunkTranscriptText(block.transcript);
    return chunkTexts.map((text, chunkIndex) => ({
      id: multipleNotes
        ? `N${blockIndex + 1}-E${chunkIndex + 1}`
        : `E${chunkIndex + 1}`,
      text,
    }));
  });
}
