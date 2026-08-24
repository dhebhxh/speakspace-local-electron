import { type LlamaContext, type NativeCompletionResult } from "llama.rn";

import {
  NO_ACTIVE_LLM_ERROR,
  NO_TRANSCRIPT_CONTEXT_ERROR,
} from "@/constants/ask-ai-grounding-policy";
import {
  ASK_AI_COMPLETION_TOP_P,
  ASK_AI_CONFIGURED_N_CTX,
  ASK_AI_GENERATION_RESERVE,
  ASK_AI_N_GPU_LAYERS,
} from "@/constants/ask-ai-inference-config";
import { InferenceError } from "@/errors/inference-error";
import { LlmModelService } from "@/services/llm-model-service";
import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";
import { SharedLlmContextService } from "@/services/shared-llm-context-service";

import { notesToTranscriptBlocks } from "./ask-ai-grounded-messages";
import {
  classifySelectedEvidence,
  type EvidenceExtractionPrompt,
  type EvidenceDecisionPrompt,
  fitEvidenceExtractionMessagesToBudget,
  fitVerifiedAnswerMessagesToBudget,
  getAskAiMetaResponse,
  getGroundingRefusal,
  type VerifiedEvidenceResult,
} from "./ask-ai-evidence-gate";
import { findMissingOverviewNumberAtoms } from "./ask-ai-evidence-text";
import { AiConversationService } from "./ai-conversation-service";

export type GenerateCallbacks = {
  onToken: (tokenText: string) => void;
};

export type GenerateResult = {
  assistantText: string;
  promptTokenCount: number;
  historyTrimmed: boolean;
};

export class LlmInferenceService {
  private activeConversationId: string | null = null;
  private isGenerating = false;
  private generationAborted = false;

  public constructor(
    private readonly llmModelService: LlmModelService,
    private readonly aiConversationService: AiConversationService,
    private readonly coordinator: LocalLlmCoordinator,
    private readonly sharedContext: SharedLlmContextService,
  ) {}

  public getIsGenerating(): boolean {
    return this.isGenerating;
  }

  public getLoadedModelId(): string | null {
    return this.sharedContext.getLoadedModelId();
  }

  public getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  /**
   * Runs grounded local inference for a conversation.
   * Canonical history is always read from the database — no extra user message param.
   */
  public async generate(
    conversationId: string,
    callbacks: GenerateCallbacks,
  ): Promise<GenerateResult> {
    if (this.isGenerating) {
      throw new InferenceError("A generation is already in progress.");
    }

    this.isGenerating = true;
    this.generationAborted = false;

    try {
      return await this.coordinator.runExclusive("ask-ai", () => this.runGeneration(conversationId, callbacks));
    } finally {
      this.isGenerating = false;
    }
  }

  private async runGeneration(conversationId: string, callbacks: GenerateCallbacks): Promise<GenerateResult> {
      await this.aiConversationService.getConversationOrThrow(conversationId);
      await this.ensureContextForActiveModel();
      await this.prepareConversationSwitch(conversationId);

      const linkedNotes =
        await this.aiConversationService.getLinkedNotes(conversationId);
      if (linkedNotes.length === 0) {
        throw new InferenceError(NO_TRANSCRIPT_CONTEXT_ERROR);
      }

      const transcriptBlocks = notesToTranscriptBlocks(linkedNotes);
      const canonicalMessages =
        await this.aiConversationService.getCanonicalMessages(conversationId);
      const lastMessage = canonicalMessages.at(-1);
      if (lastMessage?.getRole() !== "user") {
        throw new InferenceError(
          "Cannot generate a response because the latest conversation message is not from the user.",
        );
      }

      const history = canonicalMessages.map((message) => ({
        role: message.getRole(),
        content: message.getContent(),
      }));
      const currentQuestion = lastMessage.getContent();

      const metaResponse = getAskAiMetaResponse(history);
      if (metaResponse !== null) {
        if (this.generationAborted) {
          throw new InferenceError("Generation was stopped.");
        }

        await this.aiConversationService.addAssistantMessage(
          conversationId,
          metaResponse,
        );

        return {
          assistantText: metaResponse,
          promptTokenCount: 0,
          historyTrimmed: false,
        };
      }

      const context = this.getContextOrThrow();
      const extractionPrompt = await fitEvidenceExtractionMessagesToBudget(
        context,
        transcriptBlocks,
        history,
      );

      if (this.generationAborted) {
        throw new InferenceError("Generation was stopped.");
      }

      const classifiedDecisions = await this.classifyDecisionPrompts(
        context,
        extractionPrompt.decisionPrompts,
      );
      this.logEvidenceDecision(extractionPrompt, classifiedDecisions);

      const unsupportedDecision = classifiedDecisions.find(
        ({ result }) =>
          result.status !== "supported" ||
          result.verifiedEvidence.length === 0,
      );
      if (
        classifiedDecisions.length === 0 ||
        unsupportedDecision !== undefined
      ) {
        const assistantText = getGroundingRefusal();
        await this.aiConversationService.addAssistantMessage(
          conversationId,
          assistantText,
        );

        return {
          assistantText,
          promptTokenCount: extractionPrompt.promptTokenCount,
          historyTrimmed: extractionPrompt.historyTrimmed,
        };
      }

      const finalResult =
        extractionPrompt.questionKind === "multi-part"
          ? await this.generateMultiPartAnswer(
              context,
              classifiedDecisions,
              callbacks,
            )
          : await this.generateFinalAnswer(
              context,
              currentQuestion,
              classifiedDecisions[0]?.result.verifiedEvidence ?? [],
              callbacks,
            );

      const assistantText = finalResult.assistantText;

      await this.aiConversationService.addAssistantMessage(
        conversationId,
        assistantText,
      );

      return {
        assistantText,
        promptTokenCount: finalResult.promptTokenCount,
        historyTrimmed:
          extractionPrompt.historyTrimmed || finalResult.historyTrimmed,
      };
  }

  private async classifyDecisionPrompts(
    context: LlamaContext,
    decisions: EvidenceDecisionPrompt[],
  ): Promise<ClassifiedDecision[]> {
    const classifiedDecisions: ClassifiedDecision[] = [];

    for (const decision of decisions) {
      if (this.generationAborted) {
        throw new InferenceError("Generation was stopped.");
      }

      let classifierText = "";
      if (decision.deterministicGuard === "classifier-fallback") {
        const classifierResult = await context.completion({
          messages: decision.messages,
          n_predict: ASK_AI_GENERATION_RESERVE,
          temperature: 0,
          top_p: 1,
          enable_thinking: false,
          reasoning_format: "none",
        });

        if (this.generationAborted || classifierResult.interrupted) {
          throw new InferenceError("Generation was stopped.");
        }

        classifierText = this.resolveAssistantText(classifierResult, "");
      }

      const result = classifySelectedEvidence(
        classifierText,
        decision.selectedEvidenceCandidates,
        decision.question,
        decision.questionKind,
        decision.deterministicGuard,
      );

      classifiedDecisions.push({
        decision,
        classifierText:
          classifierText.length > 0
            ? classifierText
            : `(skipped: ${decision.deterministicGuard})`,
        result,
      });
    }

    return classifiedDecisions;
  }

  private async generateMultiPartAnswer(
    context: LlamaContext,
    classifiedDecisions: ClassifiedDecision[],
    callbacks: GenerateCallbacks,
  ): Promise<GenerateResult> {
    const answerParts: string[] = [];
    let promptTokenCount = 0;
    let historyTrimmed = false;

    for (let index = 0; index < classifiedDecisions.length; index += 1) {
      const classifiedDecision = classifiedDecisions[index];
      if (classifiedDecision === undefined) {
        continue;
      }

      if (index > 0) {
        callbacks.onToken("\n");
      }

      const clauseResult = await this.generateFinalAnswer(
        context,
        classifiedDecision.decision.question,
        classifiedDecision.result.verifiedEvidence,
        callbacks,
      );
      answerParts.push(clauseResult.assistantText);
      promptTokenCount += clauseResult.promptTokenCount;
      historyTrimmed = historyTrimmed || clauseResult.historyTrimmed;

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(
          `[AskAI Multi] clause ${index + 1} answer:`,
          clauseResult.assistantText,
        );
      }
    }

    return {
      assistantText: answerParts.join("\n").trim(),
      promptTokenCount,
      historyTrimmed,
    };
  }

  private async generateFinalAnswer(
    context: LlamaContext,
    currentQuestion: string,
    verifiedEvidence: string[],
    callbacks: GenerateCallbacks,
  ): Promise<GenerateResult> {
    await this.clearCacheOrFailClosed();

    if (this.generationAborted) {
      throw new InferenceError("Generation was stopped.");
    }

    const firstAttempt = await this.runFinalCompletionAttempt(
      context,
      currentQuestion,
      verifiedEvidence,
      false,
      1,
    );
    if (firstAttempt.valid) {
      callbacks.onToken(firstAttempt.result.assistantText);
      return firstAttempt.result;
    }

    const retryAttempt = await this.runFinalCompletionAttempt(
      context,
      currentQuestion,
      verifiedEvidence,
      true,
      2,
    );
    if (retryAttempt.valid) {
      callbacks.onToken(retryAttempt.result.assistantText);
      return retryAttempt.result;
    }

    const fallbackText = this.buildGroundedFallback(verifiedEvidence);
    callbacks.onToken(fallbackText);
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[AskAI Final] fallback used:", true);
      console.log("[AskAI Final] cleaned:", fallbackText);
    }

    return {
      assistantText: fallbackText,
      promptTokenCount:
        firstAttempt.result.promptTokenCount + retryAttempt.result.promptTokenCount,
      historyTrimmed:
        firstAttempt.result.historyTrimmed || retryAttempt.result.historyTrimmed,
    };
  }

  private async runFinalCompletionAttempt(
    context: LlamaContext,
    currentQuestion: string,
    verifiedEvidence: string[],
    constrainedRetry: boolean,
    attempt: number,
  ): Promise<FinalAttemptResult> {
    const finalPrompt = await fitVerifiedAnswerMessagesToBudget(
      context,
      verifiedEvidence,
      currentQuestion,
      undefined,
      constrainedRetry,
    );

    if (this.generationAborted) {
      throw new InferenceError("Generation was stopped.");
    }

    let streamedText = "";
    const streamPrefixState: StreamPrefixState = {
      buffer: "",
      resolved: false,
    };

    const completionResult = await context.completion(
      {
        messages: finalPrompt.messages,
        n_predict: ASK_AI_GENERATION_RESERVE,
        temperature: 0,
        top_p: ASK_AI_COMPLETION_TOP_P,
        enable_thinking: false,
        reasoning_format: "none",
      },
      (data) => {
        if (this.generationAborted) {
          return;
        }
        if (data.token.length > 0) {
          streamedText += data.token;
          this.streamVisibleFinalToken(data.token, streamPrefixState, {
            onToken: () => undefined,
          });
        }
      },
    );

    if (this.generationAborted || completionResult.interrupted) {
      throw new InferenceError("Generation was stopped.");
    }

    const rawAssistantText = this.resolveAssistantText(
      completionResult,
      streamedText,
    );
    const assistantText = this.cleanupFinalAssistantText(rawAssistantText);
    const validation = this.validateGeneratedAnswerAgainstEvidence(
      assistantText,
      verifiedEvidence,
      currentQuestion,
    );
    const unexpectedRefusal = this.looksLikeUnexpectedRefusal(assistantText);
    const valid = validation.valid && !unexpectedRefusal;

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[AskAI Final] attempt:", attempt);
      console.log("[AskAI Final] current question:", currentQuestion);
      console.log(
        "[AskAI Final] verified evidence:",
        verifiedEvidence.map((evidence) => evidence.slice(0, 160)),
      );
      console.log("[AskAI Final] raw:", rawAssistantText);
      console.log("[AskAI Final] validation:", validation);
      console.log("[AskAI Final] unexpected refusal:", unexpectedRefusal);
      console.log("[AskAI Final] fallback used:", false);
      console.log("[AskAI Final] cleaned:", assistantText);
    }

    return {
      valid,
      result: {
        assistantText,
        promptTokenCount: finalPrompt.promptTokenCount,
        historyTrimmed: finalPrompt.historyTrimmed,
      },
    };
  }

  private logEvidenceDecision(
    extractionPrompt: EvidenceExtractionPrompt,
    classifiedDecisions: ClassifiedDecision[],
  ): void {
    if (typeof __DEV__ === "undefined" || !__DEV__) {
      return;
    }

    console.log(
      "[AskAI Evidence] current question:",
      extractionPrompt.extractionContext.currentQuestion,
    );
    console.log(
      "[AskAI Evidence] previous turn:",
      extractionPrompt.extractionContext.previousTurn,
    );
    console.log(
      "[AskAI Retrieval] candidates:",
      extractionPrompt.retrievalCandidates.map((candidate) => ({
        id: candidate.id,
        score: candidate.score,
        preview: candidate.text.slice(0, 120),
      })),
    );
    console.log("[AskAI Analysis] question kind:", extractionPrompt.queryAnalysis.kind);
    console.log(
      "[AskAI Analysis] relation intent:",
      extractionPrompt.queryAnalysis.relation,
    );
    console.log(
      "[AskAI Analysis] expected answer:",
      extractionPrompt.queryAnalysis.expectedAnswer,
    );
    console.log(
      "[AskAI Analysis] uses previous user:",
      extractionPrompt.followUp.usesPreviousUser,
    );
    console.log(
      "[AskAI Analysis] follow-up reason:",
      extractionPrompt.followUp.reason,
    );
    console.log(
      "[AskAI Decision] anchor ID:",
      extractionPrompt.decisionPrompts
        .at(0)
        ?.selectedEvidenceCandidates.at(0)?.id ?? null,
    );
    console.log(
      "[AskAI Decision] anchor compatibility:",
      this.formatAnchorCompatibility(
        extractionPrompt.decisionPrompts.at(0)?.anchorCompatibility ?? null,
      ),
    );
    console.log(
      "[AskAI Decision] adjacent context IDs:",
      extractionPrompt.selectedEvidenceCandidates
        .slice(1)
        .map((candidate) => candidate.id),
    );
    console.log(
      "[AskAI Decision] selected IDs:",
      extractionPrompt.selectedEvidenceCandidates.map(
        (candidate) => candidate.id,
      ),
    );
    console.log(
      "[AskAI Decision] selected text:",
      extractionPrompt.selectedEvidenceCandidates.map((candidate) =>
        candidate.text.slice(0, 160),
      ),
    );

    for (const classifiedDecision of classifiedDecisions) {
      console.log(
        "[AskAI Decision] deterministic guard:",
        classifiedDecision.decision.deterministicGuard,
      );
      console.log(
        "[AskAI Decision] classifier raw:",
        classifiedDecision.classifierText,
      );
      console.log(
        "[AskAI Decision] final status:",
        classifiedDecision.result.status,
      );
    }

    if (extractionPrompt.questionKind === "multi-part") {
      console.log(
        "[AskAI Multi] clauses:",
        classifiedDecisions.map(
          (classifiedDecision) => classifiedDecision.decision.question,
        ),
      );
    }
  }

  private validateGeneratedAnswerAgainstEvidence(
    answerText: string,
    verifiedEvidence: string[],
    currentQuestion: string,
  ): GroundingValidationResult {
    const evidenceText = verifiedEvidence.join(" ");
    const normalizedEvidence = this.normalizeGroundingText(evidenceText);
    const unsupportedAtoms = this.extractHighRiskAtoms(answerText).filter(
      (atom) => !normalizedEvidence.includes(this.normalizeGroundingText(atom)),
    );
    const missingRequiredAtoms = findMissingOverviewNumberAtoms(
      currentQuestion,
      evidenceText,
      answerText,
    );

    return {
      valid:
        unsupportedAtoms.length === 0 && missingRequiredAtoms.length === 0,
      unsupportedAtoms,
      missingRequiredAtoms,
    };
  }

  private looksLikeUnexpectedRefusal(text: string): boolean {
    return /\b(i cannot|i can't|i am unable|i'm unable|cannot provide|can't provide|do not have information|don't have information|i'm sorry|i am sorry|cannot help|can't help|cannot discuss)\b/i.test(
      text,
    );
  }

  private extractHighRiskAtoms(text: string): string[] {
    const atoms = new Set<string>();

    for (const match of text.matchAll(/https?:\/\/\S+/g)) {
      atoms.add(match[0]);
    }
    for (const match of text.matchAll(/\b\d+(?::\d{2})?\b/g)) {
      atoms.add(match[0]);
    }
    for (const match of text.matchAll(/"([^"]+)"|'([^']+)'/g)) {
      atoms.add(match[1] ?? match[2] ?? match[0]);
    }
    for (const match of text.matchAll(/\b[A-Z][A-Za-z0-9]+(?:[\s.-]+[A-Z][A-Za-z0-9]+)+\b/g)) {
      atoms.add(match[0]);
    }
    for (const match of text.matchAll(/\b[A-Z][A-Za-z0-9]{2,}\b/g)) {
      if (!HIGH_RISK_COMMON_WORDS.has(match[0])) {
        atoms.add(match[0]);
      }
    }
    for (const match of text.matchAll(/\b[\w.-]+\.[A-Za-z0-9]{1,8}\b/g)) {
      atoms.add(match[0]);
    }
    for (const match of text.matchAll(/\b[A-Za-z]+[-_][A-Za-z0-9][A-Za-z0-9_-]*\b/g)) {
      atoms.add(match[0]);
    }
    for (const match of text.matchAll(/`([^`]+)`/g)) {
      atoms.add(match[1] ?? match[0]);
    }

    return [...atoms].filter(
      (atom) =>
        atom.trim().length > 1 &&
        !HIGH_RISK_COMMON_WORDS.has(atom.trim()),
    );
  }

  private normalizeGroundingText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[‐-‒–—―]/g, "-")
      .replace(/[^a-z0-9:/._\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private buildGroundedFallback(verifiedEvidence: string[]): string {
    return verifiedEvidence
      .map((evidence) => evidence.replace(/^\s*(\[[^\]]+\]|\d{1,2}:\d{2}(?::\d{2})?)\s*[-:]\s*/, ""))
      .map((evidence) => evidence.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.!?])/g, "$1")
      .trim();
  }

  private formatAnchorCompatibility(
    compatibility: ClassifiedDecision["decision"]["anchorCompatibility"],
  ): unknown {
    if (compatibility === null) {
      return null;
    }

    return {
      id: compatibility.candidate.id,
      lexicalScore: compatibility.lexicalScore,
      currentTopicScore: compatibility.currentTopicScore,
      relationScore: compatibility.relationScore,
      answerShapeScore: compatibility.answerShapeScore,
      followUpScore: compatibility.followUpScore,
      compatible: compatibility.compatible,
    };
  }

  public async stopGeneration(): Promise<void> {
    this.generationAborted = true;
    if (this.sharedContext.getContext() !== null && this.isGenerating) {
      await this.sharedContext.getContext()?.stopCompletion().catch(() => undefined);
    }
  }

  public async releaseContext(): Promise<void> {
    if (this.isGenerating) {
      throw new InferenceError(
        "Cannot release Llama context while generation is in progress. Call stopGeneration(), wait for the current generate() promise to settle, then call releaseContext().",
      );
    }

    await this.sharedContext.release();
    this.activeConversationId = null;
  }

  /**
   * Ensures the native context matches the current active GGUF model.
   * Does not modify activeConversationId except when the model changes
   * (KV cache is invalidated by releasing the native context).
   */
  private async ensureContextForActiveModel(): Promise<void> {
    const activeModel = await this.llmModelService.getActiveModel();
    if (activeModel === null) {
      throw new InferenceError(NO_ACTIVE_LLM_ERROR);
    }

    const activeModelId = activeModel.getId();

    const modelFile = this.llmModelService.resolveModelFile(activeModel);
    if (!modelFile.exists) {
      throw new InferenceError(
        "The active model file is missing on this device.",
      );
    }

    const prepared = await this.sharedContext.prepare(activeModelId, modelFile.uri);
    console.info("[AskAI] Shared model context prepared", { modelId: activeModelId, reused: prepared.reused, contextPrepareMs: prepared.contextPrepareMs, promptBudgetContextSize: ASK_AI_CONFIGURED_N_CTX, gpuLayers: ASK_AI_N_GPU_LAYERS });
  }

  /**
   * Isolates KV cache between conversations.
   * Must run after ensureContextForActiveModel and before inference.
   */
  private async prepareConversationSwitch(
    conversationId: string,
  ): Promise<void> {
    await this.clearCacheOrFailClosed();
    this.activeConversationId = conversationId;
  }

  /**
   * Fail-closed: if clearCache fails, release the native context so the next
   * request gets a clean LlamaContext rather than a potentially contaminated one.
   */
  private async clearCacheOrFailClosed(): Promise<void> {
    const context = this.getContextOrThrow();

    try {
      await context.clearCache(false);
    } catch {
      await this.releaseNativeContext();
      this.activeConversationId = null;
      throw new InferenceError(
        "Unable to clear conversation cache safely. Please retry.",
      );
    }
  }

  private async releaseNativeContext(): Promise<void> {
    await this.sharedContext.release();
  }

  private getContextOrThrow(): LlamaContext {
    const context = this.sharedContext.getContext();
    if (context === null) {
      throw new InferenceError("Llama context is not initialized.");
    }
    return context;
  }

  private resolveAssistantText(
    result: NativeCompletionResult,
    streamedText: string,
  ): string {
    const fromResult = result.content?.trim() || result.text?.trim() || "";
    const fromStream = streamedText.trim();
    return fromResult.length > 0 ? fromResult : fromStream;
  }

  private cleanupFinalAssistantText(text: string): string {
    if (this.hasMultipleLeadingBulletLines(text)) {
      return text;
    }

    return text.replace(/^[-*•]\s+/, "").trim();
  }

  private hasMultipleLeadingBulletLines(text: string): boolean {
    const bulletLines = text
      .split(/\r?\n/)
      .filter((line) => /^[-*•]\s+/.test(line.trim()));
    return bulletLines.length > 1;
  }

  private streamVisibleFinalToken(
    token: string,
    state: StreamPrefixState,
    callbacks: GenerateCallbacks,
  ): void {
    if (state.resolved) {
      callbacks.onToken(token);
      return;
    }

    state.buffer += token;
    const visiblePrefix = this.resolveVisibleStreamPrefix(state.buffer);
    if (visiblePrefix === null) {
      return;
    }

    state.resolved = true;
    state.buffer = "";
    if (visiblePrefix.length > 0) {
      callbacks.onToken(visiblePrefix);
    }
  }

  private resolveVisibleStreamPrefix(buffer: string): string | null {
    const withoutLeadingWhitespace = buffer.replace(/^\s+/, "");
    if (withoutLeadingWhitespace.length === 0) {
      return null;
    }

    const firstCharacter = withoutLeadingWhitespace[0];
    if (
      firstCharacter !== "-" &&
      firstCharacter !== "*" &&
      firstCharacter !== "•"
    ) {
      return withoutLeadingWhitespace;
    }

    if (withoutLeadingWhitespace.length === 1) {
      return null;
    }

    const markerNextCharacter = withoutLeadingWhitespace[1];
    if (/\s/.test(markerNextCharacter)) {
      return withoutLeadingWhitespace.slice(2).replace(/^\s+/, "");
    }

    return withoutLeadingWhitespace;
  }
}

type StreamPrefixState = {
  buffer: string;
  resolved: boolean;
};

type ClassifiedDecision = {
  decision: EvidenceDecisionPrompt;
  classifierText: string;
  result: VerifiedEvidenceResult;
};

type GroundingValidationResult = {
  valid: boolean;
  unsupportedAtoms: string[];
  missingRequiredAtoms: string[];
};

type FinalAttemptResult = {
  valid: boolean;
  result: GenerateResult;
};

const HIGH_RISK_COMMON_WORDS = new Set([
  "The",
  "This",
  "That",
  "These",
  "Those",
  "There",
  "It",
  "They",
  "He",
  "She",
  "Yes",
  "No",
]);
