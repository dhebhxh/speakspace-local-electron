import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from "llama.rn";

import { getKnowledgeScenarioDefinition } from "@/constants/knowledge-scenarios";
import { KnowledgeDocument, type KnowledgeScenario, type KnowledgeSection } from "@/domain/knowledge/knowledge-document";
import type { KnowledgeTemplate } from "@/domain/knowledge/knowledge-template";
import { KnowledgeGenerationError } from "@/errors/knowledge-generation-error";
import { KnowledgeDocumentRepository } from "@/repositories/knowledge-document-repository";
import { LlmModelService } from "@/services/llm-model-service";
import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";
import { InferenceDeadline, type InferenceAbortReason } from "@/services/inference-deadline";
import { KNOWLEDGE_GENERATION_DEADLINE_MS } from "@/constants/local-ai-deadlines";

type ModelOutput = { sections?: Record<string, unknown> };
type GenerationDefinition = {
  scenario: KnowledgeScenario;
  name: string;
  sections: readonly { key: string; title: string; instruction: string }[];
  templateId: string | null;
  templateName: string;
};
type ActiveKnowledgeRequest = { requestId: string; deadline: InferenceDeadline; context: LlamaContext | null; scenario: KnowledgeScenario };

const MODEL_CONTEXT_SIZE = 6144;
const MODEL_BATCH_SIZE = 128;
const MAX_PREDICTED_TOKENS = 1792;
const CONTEXT_SAFETY_TOKENS = 192;
const SYSTEM_PROMPT = `Extract scenario-specific knowledge from NOTE. Core Note Insights separately handles summary, general key points, tasks/action items, reminders, and calendar intents; do not recreate those categories.
Use only information supported by NOTE. You may organize, combine repetition, and clearly restate supported relationships, but never add outside knowledge, new facts, opinions, conclusions, questions, or advice. Preserve uncertainty, attribution, and the note's primary language. A field with no evidence must be []. Return only JSON matching the schema.`;

export class KnowledgeService {
  private readonly generationStates = new Map<string, KnowledgeGenerationState>();
  private readonly activeGenerations = new Map<string, Promise<KnowledgeDocument>>();
  private readonly activeRequests = new Map<string, ActiveKnowledgeRequest>();
  private readonly listeners = new Map<string, Set<(state: KnowledgeGenerationState) => void>>();

  public constructor(private readonly repository: KnowledgeDocumentRepository, private readonly llmModelService: LlmModelService, private readonly coordinator: LocalLlmCoordinator) {}

  public getForNote(noteId: string): Promise<KnowledgeDocument | null> {
    return this.repository.findByNoteId(noteId);
  }

  public getHistoryForNote(noteId: string): Promise<KnowledgeDocument[]> {
    return this.repository.findAllByNoteId(noteId);
  }

  public deleteResult(noteId: string, resultId: string): Promise<void> {
    return this.repository.deleteResult(resultId, noteId);
  }

  public getGenerationState(noteId: string): KnowledgeGenerationState {
    return this.generationStates.get(noteId) ?? { status: "idle" };
  }

  public subscribeToGeneration(noteId: string, listener: (state: KnowledgeGenerationState) => void): () => void {
    const listeners = this.listeners.get(noteId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(noteId, listeners);
    console.info("[Knowledge] Generation observer subscribed", { noteId, observerCount: listeners.size, currentStatus: this.getGenerationState(noteId).status });
    listener(this.getGenerationState(noteId));
    return () => {
      listeners.delete(listener);
      console.info("[Knowledge] Generation observer unsubscribed", { noteId, observerCount: listeners.size, currentStatus: this.getGenerationState(noteId).status });
      if (listeners.size === 0) this.listeners.delete(noteId);
    };
  }

  public generate(noteId: string, transcript: string, scenario: KnowledgeScenario): Promise<KnowledgeDocument> {
    const builtIn = getKnowledgeScenarioDefinition(scenario);
    return this.startGeneration(noteId, transcript, {
      scenario,
      name: builtIn.name,
      sections: builtIn.sections,
      templateId: null,
      templateName: builtIn.name,
    });
  }

  public generateCustom(noteId: string, transcript: string, template: KnowledgeTemplate): Promise<KnowledgeDocument> {
    return this.startGeneration(noteId, transcript, {
      scenario: "general",
      name: template.getName(),
      sections: template.getSections(),
      templateId: template.getId(),
      templateName: template.getName(),
    });
  }

  private startGeneration(noteId: string, transcript: string, definition: GenerationDefinition): Promise<KnowledgeDocument> {
    const scenario = definition.scenario;
    const state = this.getGenerationState(noteId);
    const existing = this.activeGenerations.get(noteId);
    if (existing && (state.status === "queued" || state.status === "generating" || state.status === "stopping")) {
      console.info("[Knowledge] Reusing in-flight generation", { noteId, requestId: state.requestId, requestedScenario: scenario, activeScenario: state.scenario });
      return existing;
    }

    const requestId = `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    const deadline = new InferenceDeadline(KNOWLEDGE_GENERATION_DEADLINE_MS);
    const request: ActiveKnowledgeRequest = { requestId, deadline, context: null, scenario };
    this.activeRequests.set(noteId, request);
    deadline.signal.addEventListener("abort", () => {
      const active = this.activeRequests.get(noteId);
      if (active !== request) return;
      this.publish(noteId, { status: "stopping", requestId, scenario, startedAt });
      void active.context?.stopCompletion().catch(() => undefined);
    }, { once: true });
    this.publish(noteId, { status: "queued", requestId, scenario, startedAt });
    const promise = this.coordinator.runExclusive("knowledge", async () => {
      deadline.throwIfAborted((reason) => this.abortError(reason));
      this.publish(noteId, { status: "generating", requestId, scenario, startedAt });
      return this.runGeneration(noteId, transcript, definition, requestId, request);
    }, { signal: deadline.signal }).catch((error: unknown) => {
      if (deadline.reason) throw this.abortError(deadline.reason);
      throw error;
    });
    this.activeGenerations.set(noteId, promise);
    void promise.then(
      () => {
        deadline.dispose();
        this.activeGenerations.delete(noteId);
        if (this.activeRequests.get(noteId) === request) this.activeRequests.delete(noteId);
        this.publish(noteId, { status: "completed", requestId, scenario, finishedAt: Date.now() });
      },
      (error: unknown) => {
        deadline.dispose();
        this.activeGenerations.delete(noteId);
        if (this.activeRequests.get(noteId) === request) this.activeRequests.delete(noteId);
        this.publish(noteId, { status: "failed", requestId, scenario, finishedAt: Date.now(), message: error instanceof Error ? error.message : "Knowledge generation did not finish. Please try again." });
      },
    );
    return promise;
  }

  public async stopGeneration(noteId: string): Promise<void> {
    const request = this.activeRequests.get(noteId);
    if (!request) return;
    request.deadline.abort("cancelled");
    await request.context?.stopCompletion().catch(() => undefined);
  }

  public async stopAllGenerations(): Promise<void> {
    await Promise.all([...this.activeRequests.keys()].map((noteId) => this.stopGeneration(noteId)));
  }

  private async runGeneration(noteId: string, transcript: string, definition: GenerationDefinition, requestId: string, request: ActiveKnowledgeRequest): Promise<KnowledgeDocument> {
    const scenario = definition.scenario;
    const generationStartedAt = Date.now();
    const input = transcript.trim();
    request.deadline.throwIfAborted((reason) => this.abortError(reason));
    if (!input) throw new KnowledgeGenerationError("empty-transcript", "This note has no transcript to organize yet.");
    console.info("[Knowledge] Generation requested", { requestId, noteId, scenario, transcriptLength: input.length });

    const model = await this.llmModelService.getActiveModel();
    if (!model) throw new KnowledgeGenerationError("model-unavailable", "Choose and activate a local language model in AI Models first.");
    const modelFile = this.llmModelService.resolveModelFile(model);
    if (!modelFile.exists) throw new KnowledgeGenerationError("model-file-missing", "The active model file is missing. Reinstall it from AI Models.");

    let context: LlamaContext | null = null;
    try {
      const modelLoadStartedAt = Date.now();
      context = await initLlama({ model: modelFile.uri, n_ctx: MODEL_CONTEXT_SIZE, n_batch: MODEL_BATCH_SIZE });
      request.context = context;
      request.deadline.throwIfAborted((reason) => this.abortError(reason));
      console.info("[Knowledge] Local model loaded", { requestId, modelId: model.getId(), durationMs: Date.now() - modelLoadStartedAt, contextSize: MODEL_CONTEXT_SIZE });

      const sectionShape = Object.fromEntries(definition.sections.map((section) => [section.key, []]));
      const sectionProperties = Object.fromEntries(definition.sections.map((section) => [section.key, { type: "array", items: { type: "string" } }]));
      const sectionGuide = definition.sections.map((section) => `- ${section.key} (${section.title}): ${section.instruction}`).join("\n");
      const makeMessages = (note: string): RNLlamaOAICompatibleMessage[] => [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract a ${definition.name} knowledge document. Return exactly this JSON shape: {"sections":${JSON.stringify(sectionShape)}}.

FIELD RULES
${sectionGuide}

QUALITY RULES
- Each item must state concrete content from NOTE, not a topic label or vague mention.
- Include relevant facts, explanation, relationship, rationale, attribution, examples, conditions, and context when they belong together.
- Cover all meaningful supported material. There is no fixed item count or item length; adapt depth and coverage to NOTE's length and information density.
- Keep distinct information distinct; merge only semantic duplicates. Do not omit useful detail merely to be concise.
- Do not recreate a universal summary or key-points list, and do not output tasks, reminders, or calendar intents.
- Use [] when NOTE does not support a field. Never fill a field by guessing.

NOTE:
---
${note}
---` },
      ];

      const maxPromptTokens = MODEL_CONTEXT_SIZE - MAX_PREDICTED_TOKENS - CONTEXT_SAFETY_TOKENS;
      let usedInput = input;
      let messages = makeMessages(usedInput);
      let promptTokens = await this.countTokens(context, messages, request.deadline);
      if (promptTokens > maxPromptTokens) {
        let low = 0;
        let high = input.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (await this.countTokens(context, makeMessages(input.slice(0, middle)), request.deadline) <= maxPromptTokens) low = middle;
          else high = middle - 1;
        }
        usedInput = input.slice(0, low).trimEnd();
        messages = makeMessages(usedInput);
        promptTokens = await this.countTokens(context, messages, request.deadline);
        console.warn("[Knowledge] Transcript truncated by token budget", { requestId, originalLength: input.length, usedLength: usedInput.length, promptTokens, outputTokens: MAX_PREDICTED_TOKENS });
      }
      console.info("[Knowledge] Prompt prepared", { requestId, scenario, transcriptLength: usedInput.length, promptTokens, outputTokens: MAX_PREDICTED_TOKENS, requestedSectionCount: definition.sections.length });

      const completionStartedAt = Date.now();
      const result = await context.completion({
        messages,
        response_format: { type: "json_schema", json_schema: { strict: true, schema: {
          type: "object",
          properties: { sections: { type: "object", properties: sectionProperties, required: definition.sections.map((section) => section.key), additionalProperties: false } },
          required: ["sections"],
          additionalProperties: false,
        } } },
        n_predict: MAX_PREDICTED_TOKENS,
        temperature: 0,
      });
      request.deadline.throwIfAborted((reason) => this.abortError(reason));
      const rawOutput = result.content || result.text;
      console.info("[Knowledge] Local completion finished", { requestId, modelId: model.getId(), durationMs: Date.now() - completionStartedAt, outputLength: rawOutput.length, nPredict: MAX_PREDICTED_TOKENS, temperature: 0 });
      const document = this.toDocument(noteId, definition, model.getId(), rawOutput, requestId);
      const itemCount = document.getSections().reduce((count, section) => count + section.items.length, 0);
      console.info("[Knowledge] Model output parsed", { requestId, sectionCount: document.getSections().length, itemCount });
      await this.repository.save(document);
      console.info("[Knowledge] Generation completed", { requestId, noteId, scenario, modelId: model.getId(), totalDurationMs: Date.now() - generationStartedAt, itemCount });
      return document;
    } catch (error) {
      console.error("[Knowledge] Generation failed", { requestId, noteId, scenario, durationMs: Date.now() - generationStartedAt, errorCode: error instanceof KnowledgeGenerationError ? error.code : "unexpected", error });
      if (request.deadline.reason) throw this.abortError(request.deadline.reason);
      if (error instanceof KnowledgeGenerationError) throw error;
      throw new KnowledgeGenerationError("generation-failed", "Knowledge generation did not finish. Please try again.", { cause: error instanceof Error ? error : undefined });
    } finally {
      if (context) try {
        const releaseStartedAt = Date.now();
        console.info("[Knowledge] Releasing model context", { requestId, noteId });
        await context.release();
        console.info("[Knowledge] Model context released", { requestId, noteId, durationMs: Date.now() - releaseStartedAt });
      } catch (error) { console.warn("[Knowledge] Could not release model context", { requestId, error }); }
      if (request.context === context) request.context = null;
    }
  }

  private publish(noteId: string, state: KnowledgeGenerationState): void {
    const previousStatus = this.getGenerationState(noteId).status;
    this.generationStates.set(noteId, state);
    console.info("[Knowledge] Generation state changed", { noteId, requestId: "requestId" in state ? state.requestId : null, scenario: "scenario" in state ? state.scenario : null, previousStatus, status: state.status, observerCount: this.listeners.get(noteId)?.size ?? 0 });
    this.listeners.get(noteId)?.forEach((listener) => listener(state));
  }

  private async countTokens(context: LlamaContext, messages: RNLlamaOAICompatibleMessage[], deadline: InferenceDeadline): Promise<number> {
    deadline.throwIfAborted((reason) => this.abortError(reason));
    const formatted = await context.getFormattedChat(messages, null, { jinja: true, enable_thinking: false, reasoning_format: "none" });
    const count = (await context.tokenize(formatted.prompt ?? "")).tokens.length;
    deadline.throwIfAborted((reason) => this.abortError(reason));
    return count;
  }

  private abortError(reason: InferenceAbortReason): KnowledgeGenerationError {
    return reason === "timeout"
      ? new KnowledgeGenerationError("timeout", "Knowledge reached its 2-minute limit. Existing results are safe; please retry.")
      : new KnowledgeGenerationError("cancelled", "Knowledge generation was stopped. Existing results are safe; you can retry.");
  }

  private toDocument(noteId: string, definition: GenerationDefinition, modelId: string, raw: string, requestId: string): KnowledgeDocument {
    let parsed: ModelOutput;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? raw) as ModelOutput;
    } catch (error) {
      console.warn("[Knowledge] Model returned invalid JSON", { requestId, outputLength: raw.length });
      throw new KnowledgeGenerationError("invalid-output", "The local model returned an unreadable result. Try again or select a stronger model.", { cause: error instanceof Error ? error : undefined });
    }
    if (!parsed.sections || typeof parsed.sections !== "object" || Array.isArray(parsed.sections)) {
      console.warn("[Knowledge] Model returned incomplete JSON", { requestId, hasSections: Boolean(parsed.sections && typeof parsed.sections === "object") });
      throw new KnowledgeGenerationError("invalid-output", "The local model returned an incomplete result. Please try again.");
    }
    const sections: KnowledgeSection[] = definition.sections.map((section) => ({
      key: section.key,
      title: section.title,
      items: Array.isArray(parsed.sections?.[section.key])
        ? (parsed.sections[section.key] as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : [],
    }));
    const now = new Date().toISOString();
    // Keep the legacy database column empty for compatibility; scenario knowledge no longer owns a summary.
    return new KnowledgeDocument(
      `knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      noteId,
      definition.scenario,
      "",
      sections,
      modelId,
      now,
      now,
      definition.templateId,
      definition.templateName,
      false,
    );
  }
}

export type KnowledgeGenerationState =
  | { status: "idle" }
  | { status: "queued" | "generating" | "stopping"; requestId: string; scenario: KnowledgeScenario; startedAt: number }
  | { status: "completed"; requestId: string; scenario: KnowledgeScenario; finishedAt: number }
  | { status: "failed"; requestId: string; scenario: KnowledgeScenario; finishedAt: number; message: string };
