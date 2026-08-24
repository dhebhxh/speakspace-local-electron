import { type LlamaContext, type NativeCompletionResult } from "llama.rn";

import {
  NO_ACTIVE_LLM_ERROR,
  NO_TRANSCRIPT_CONTEXT_ERROR,
} from "@/constants/ask-ai-grounding-policy";
import {
  ASK_AI_COMPLETION_TEMPERATURE,
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
import { AiConversationService } from "./ai-conversation-service";
import { fitGroundedMessagesToBudget } from "./llm-context-budget";

export type GenerateCallbacks = { onToken: (tokenText: string) => void };

export type GenerateResult = {
  assistantText: string;
  promptTokenCount: number;
  historyTrimmed: boolean;
};

/** Runs one grounded completion over the linked transcript and chat history. */
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
      return await this.coordinator.runExclusive("ask-ai", () =>
        this.runGeneration(conversationId, callbacks),
      );
    } finally {
      this.isGenerating = false;
    }
  }

  private async runGeneration(
    conversationId: string,
    callbacks: GenerateCallbacks,
  ): Promise<GenerateResult> {
    await this.aiConversationService.getConversationOrThrow(conversationId);
    await this.ensureContextForActiveModel();
    await this.prepareConversationSwitch(conversationId);

    const linkedNotes =
      await this.aiConversationService.getLinkedNotes(conversationId);
    if (linkedNotes.length === 0) {
      throw new InferenceError(NO_TRANSCRIPT_CONTEXT_ERROR);
    }

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
    const context = this.getContextOrThrow();
    const prompt = await fitGroundedMessagesToBudget(
      context,
      notesToTranscriptBlocks(linkedNotes),
      history,
    );

    if (this.generationAborted) {
      throw new InferenceError("Generation was stopped.");
    }

    let streamedText = "";
    const completionResult = await context.completion(
      {
        messages: prompt.messages,
        n_predict: ASK_AI_GENERATION_RESERVE,
        temperature: ASK_AI_COMPLETION_TEMPERATURE,
        top_p: ASK_AI_COMPLETION_TOP_P,
        enable_thinking: false,
        reasoning_format: "none",
      },
      (data) => {
        if (this.generationAborted || data.token.length === 0) return;
        streamedText += data.token;
        callbacks.onToken(data.token);
      },
    );

    if (this.generationAborted || completionResult.interrupted) {
      throw new InferenceError("Generation was stopped.");
    }

    const assistantText = this.resolveAssistantText(
      completionResult,
      streamedText,
    );
    if (assistantText.length === 0) {
      throw new InferenceError("The language model returned an empty response.");
    }
    if (streamedText.trim().length === 0) callbacks.onToken(assistantText);

    await this.aiConversationService.addAssistantMessage(
      conversationId,
      assistantText,
    );

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[AskAI] grounded completion", {
        transcriptCount: linkedNotes.length,
        historyTrimmed: prompt.historyTrimmed,
        promptTokenCount: prompt.promptTokenCount,
      });
    }

    return {
      assistantText,
      promptTokenCount: prompt.promptTokenCount,
      historyTrimmed: prompt.historyTrimmed,
    };
  }

  public async stopGeneration(): Promise<void> {
    this.generationAborted = true;
    if (this.sharedContext.getContext() !== null && this.isGenerating) {
      await this.sharedContext
        .getContext()
        ?.stopCompletion()
        .catch(() => undefined);
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

  private async ensureContextForActiveModel(): Promise<void> {
    const activeModel = await this.llmModelService.getActiveModel();
    if (activeModel === null) throw new InferenceError(NO_ACTIVE_LLM_ERROR);

    const activeModelId = activeModel.getId();
    const modelFile = this.llmModelService.resolveModelFile(activeModel);
    if (!modelFile.exists) {
      throw new InferenceError("The active model file is missing on this device.");
    }

    const prepared = await this.sharedContext.prepare(
      activeModelId,
      modelFile.uri,
    );
    console.info("[AskAI] Shared model context prepared", {
      modelId: activeModelId,
      reused: prepared.reused,
      contextPrepareMs: prepared.contextPrepareMs,
      promptBudgetContextSize: ASK_AI_CONFIGURED_N_CTX,
      gpuLayers: ASK_AI_N_GPU_LAYERS,
    });
  }

  private async prepareConversationSwitch(
    conversationId: string,
  ): Promise<void> {
    await this.clearCacheOrFailClosed();
    this.activeConversationId = conversationId;
  }

  private async clearCacheOrFailClosed(): Promise<void> {
    const context = this.getContextOrThrow();
    try {
      await context.clearCache(false);
    } catch {
      await this.sharedContext.release();
      this.activeConversationId = null;
      throw new InferenceError(
        "Unable to clear conversation cache safely. Please retry.",
      );
    }
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
    return fromResult.length > 0 ? fromResult : streamedText.trim();
  }
}
