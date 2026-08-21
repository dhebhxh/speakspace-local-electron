import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from "llama.rn";

import { CoreNoteInsight, type CoreActionItem, type CoreCalendarIntent, type CoreCalendarIntentKind, type CoreTask } from "@/domain/core-note-insight/core-note-insight";
import { CoreNoteInsightGenerationError } from "@/errors/core-note-insight-generation-error";
import { CoreNoteInsightRepository } from "@/repositories/core-note-insight-repository";
import { getLocalReferenceTime, resolveCoreNoteTime, type ResolvedCoreNoteTime } from "@/services/core-note-time";
import { LlmModelService } from "@/services/llm-model-service";
import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";

type OutputItem = { title?: unknown; description?: unknown; startsAtExpression?: unknown; dueAtExpression?: unknown };
type OutputCalendar = OutputItem & { endsAtExpression?: unknown; remindAtExpression?: unknown; allDay?: unknown; timezone?: unknown };
type OutputTask = OutputItem & { actionItems?: unknown };
type ContentOutput = { summary?: unknown; keyPoints?: unknown };
type IntentOutput = { tasks?: unknown; reminders?: unknown; calendarIntents?: unknown };

const CONTEXT_SIZE = 6144;
const BATCH_SIZE = 128;
const CONTENT_TOKENS = 1408;
const INTENT_TOKENS = 1152;
const SAFETY_TOKENS = 192;
const EMPTY_VALUE_STRINGS = new Set(["null", "unknown", "undefined", "none", "n/a", "na", "not specified", "unspecified"]);
const SYSTEM = `Perform grounded summarization and extraction from the user's NOTE.
Use only information supported by NOTE. You may compress, reorder, merge repetition, and state relationships explicit in context. Never add outside knowledge or invent facts, people, commands, decisions, dates, times, places, tasks, reminders, or events. Preserve uncertainty and the note's primary language. Empty categories must stay empty. Return only JSON matching the schema.`;
const CONTENT_PROMPT = `Produce an information summary and concrete key points.

SUMMARY
- Answer: what must the user know to understand this note without rereading it?
- Use coherent, complete sentences with necessary context. It is not a title, topic label, or vague one-line description.
- Compress instead of retelling every sentence. Adapt detail to the note: brief for short/sparse notes; fuller for long/dense notes. There is no fixed length.

KEY POINTS
- Each item states one specific supported fact, explanation, cause/effect, condition, limitation, conclusion, decision, method, caution, or consequential detail.
- Say what the note says about a subject, not merely that it discusses the subject.
- Keep each item concise: use one short, self-contained sentence and include only one main point.
- Prefer direct wording. Remove setup, repetition, filler, and details already clear from another key point.
- Select enough items to cover the important information; there is no fixed count.
- Avoid semantic duplicates and do not turn examples into general facts.

Silently identify important propositions and check coverage before answering. Do not output that analysis.`;
const INTENT_PROMPT = `Classify only genuine action and time intent. Accuracy and empty arrays are more important than filling fields.

TASKS
- Include only an action the note explicitly assigns, requests, commits to, or clearly leaves to be done.
- Exclude facts, explanations, unaccepted advice, examples, tutorials/demonstrations, completed actions, and descriptions of how something generally works.
- An action verb alone does not imply a task.
- actionItems may contain only distinct steps explicitly present in NOTE. Never invent a plan. Use [] when no separate steps were stated.
- Do not duplicate a task title as an action item or create redundant parent/child wording.

REMINDERS
- Include only an explicit intent to remember or be notified, not something that merely seems worth remembering.

CALENDAR INTENTS
- Include only an explicit event, appointment, meeting, or scheduling intent. A time expression alone is not an event and does not imply a meeting.

TIME FIELDS
- Copy the exact natural-language time phrase from NOTE into the matching *Expression field.
- Do not calculate calendar dates or convert relative expressions to ISO; the application does that from REFERENCE TIME.
- Use JSON null when NOTE provides no expression for a field. Never invent a year, month, day, clock time, end time, or timezone.
- Keep words such as "around", "afternoon", and "evening" in the copied expression.
- For an unknown optional field, output the JSON literal null. Never output the strings "null", "unknown", "undefined", "N/A", or "none".

Silently test every candidate against these rules before answering. Do not output that analysis.`;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const itemProperties = { title: { type: "string" }, description: nullableString, startsAtExpression: nullableString, dueAtExpression: nullableString } as const;
const itemRequired = ["title", "description", "startsAtExpression", "dueAtExpression"];
const contentSchema = { type: "object", properties: { summary: { type: "string" }, keyPoints: { type: "array", items: { type: "string" } } }, required: ["summary", "keyPoints"], additionalProperties: false } as const;
const intentSchema = {
  type: "object",
  properties: {
    tasks: { type: "array", items: { type: "object", properties: { ...itemProperties, actionItems: { type: "array", items: { type: "object", properties: itemProperties, required: itemRequired, additionalProperties: false } } }, required: [...itemRequired, "actionItems"], additionalProperties: false } },
    reminders: { type: "array", items: { type: "object", properties: { ...itemProperties, remindAtExpression: nullableString }, required: [...itemRequired, "remindAtExpression"], additionalProperties: false } },
    calendarIntents: { type: "array", items: { type: "object", properties: { ...itemProperties, endsAtExpression: nullableString, remindAtExpression: nullableString, allDay: { type: "boolean" }, timezone: nullableString }, required: [...itemRequired, "endsAtExpression", "remindAtExpression", "allDay", "timezone"], additionalProperties: false } },
  },
  required: ["tasks", "reminders", "calendarIntents"], additionalProperties: false,
} as const;

export class CoreNoteInsightService {
  public getDashboardItems() {
    return this.repository.findDashboardItems();
  }

  private readonly generationStates = new Map<string, CoreInsightGenerationState>();
  private readonly activeGenerations = new Map<string, Promise<CoreNoteInsight>>();
  private readonly listeners = new Map<string, Set<(state: CoreInsightGenerationState) => void>>();

  public constructor(
    private readonly repository: CoreNoteInsightRepository,
    private readonly llmModelService: LlmModelService,
    private readonly coordinator: LocalLlmCoordinator,
  ) {}
  public getForNote(noteId: string): Promise<CoreNoteInsight | null> { return this.repository.findByNoteId(noteId); }

  public async setTaskCompleted(noteId: string, taskId: string, completed: boolean): Promise<CoreNoteInsight> {
    await this.repository.setTaskCompleted(noteId, taskId, completed);
    return this.getUpdatedInsight(noteId);
  }

  private async getUpdatedInsight(noteId: string): Promise<CoreNoteInsight> {
    const insight = await this.repository.findByNoteId(noteId);
    if (!insight) throw new CoreNoteInsightGenerationError("invalid-output", "Core note insights are no longer available.");
    return insight;
  }

  public getGenerationState(noteId: string): CoreInsightGenerationState {
    return this.generationStates.get(noteId) ?? { status: "idle" };
  }

  public subscribeToGeneration(noteId: string, listener: (state: CoreInsightGenerationState) => void): () => void {
    const listeners = this.listeners.get(noteId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(noteId, listeners);
    console.info("[CoreInsights] Generation observer subscribed", { noteId, observerCount: listeners.size, currentStatus: this.getGenerationState(noteId).status });
    listener(this.getGenerationState(noteId));
    return () => {
      listeners.delete(listener);
      console.info("[CoreInsights] Generation observer unsubscribed", { noteId, observerCount: listeners.size, currentStatus: this.getGenerationState(noteId).status });
      if (listeners.size === 0) this.listeners.delete(noteId);
    };
  }

  public generate(noteId: string, transcript: string): Promise<CoreNoteInsight> {
    const state = this.getGenerationState(noteId);
    const existing = this.activeGenerations.get(noteId);
    if (existing && (state.status === "queued" || state.status === "generating")) {
      console.info("[CoreInsights] Reusing in-flight generation", { noteId, requestId: state.requestId });
      return existing;
    }

    const requestId = `core-insights-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.publish(noteId, { status: "queued", requestId, startedAt: Date.now() });
    const promise = this.coordinator.runExclusive("core-insights", async () => {
      this.publish(noteId, { status: "generating", requestId, startedAt: Date.now() });
      return this.runGeneration(noteId, transcript, requestId);
    });
    this.activeGenerations.set(noteId, promise);
    void promise.then(
      () => {
        this.activeGenerations.delete(noteId);
        this.publish(noteId, { status: "completed", requestId, finishedAt: Date.now() });
      },
      (error: unknown) => {
        this.activeGenerations.delete(noteId);
        this.publish(noteId, { status: "failed", requestId, finishedAt: Date.now(), message: error instanceof Error ? error.message : "Core note insights did not finish. Please try again." });
      },
    );
    return promise;
  }

  private async runGeneration(noteId: string, transcript: string, requestId: string): Promise<CoreNoteInsight> {
    const startedAt = Date.now();
    const input = transcript.trim();
    console.info("[CoreInsights] Input received", { requestId, noteId, inputLength: input.length });
    if (!input) throw new CoreNoteInsightGenerationError("empty-transcript", "This note has no text to analyze yet.");
    const model = await this.llmModelService.getActiveModel();
    if (!model) throw new CoreNoteInsightGenerationError("model-unavailable", "Choose and activate a local language model in AI Models first.");
    const modelFile = this.llmModelService.resolveModelFile(model);
    if (!modelFile.exists) throw new CoreNoteInsightGenerationError("model-file-missing", "The active model file is missing. Reinstall it from AI Models.");

    let context: LlamaContext | null = null;
    try {
      console.info("[CoreInsights] Local LLM starting", { requestId, noteId, modelId: model.getId(), contextSize: CONTEXT_SIZE, stages: 2 });
      context = await initLlama({ model: modelFile.uri, n_ctx: CONTEXT_SIZE, n_batch: BATCH_SIZE });
      const reference = getLocalReferenceTime();
      console.info("[CoreInsights] Local time reference captured", { requestId, referenceTime: reference.localIso, timezone: reference.timezone });
      const contentRaw = await this.runStage(context, CONTENT_PROMPT, input, contentSchema, CONTENT_TOKENS, requestId, "content");
      const content = this.parseJson<ContentOutput>(contentRaw);
      const timeContext = `${INTENT_PROMPT}\n\nREFERENCE TIME (device local clock; context only, do not copy it unless NOTE contains that time):\n${reference.localIso}\nDEVICE TIMEZONE:\n${reference.timezone}`;
      const intentRaw = await this.runStage(context, timeContext, input, intentSchema, INTENT_TOKENS, requestId, "intent");
      const intents = this.parseJson<IntentOutput>(intentRaw);
      const insight = this.parse(noteId, model.getId(), content, intents, requestId, reference.instant, reference.localIso, reference.timezone);
      const calendars = insight.getCalendarIntents();
      console.info("[CoreInsights] Structured output parsed", { requestId, summaryLength: insight.getSummary().length, keyPointCount: insight.getKeyPoints().length, taskCount: insight.getTasks().length, actionItemCount: insight.getActionItems().length, reminderCount: calendars.filter((x) => x.kind === "reminder").length, calendarIntentCount: calendars.filter((x) => x.kind === "calendar").length });
      await this.repository.save(insight);
      console.info("[CoreInsights] Saved and ready for display", { requestId, noteId, durationMs: Date.now() - startedAt });
      return insight;
    } catch (error) {
      console.error("[CoreInsights] Generation failed", { requestId, noteId, durationMs: Date.now() - startedAt, errorCode: error instanceof CoreNoteInsightGenerationError ? error.code : "unexpected", error });
      if (error instanceof CoreNoteInsightGenerationError) throw error;
      throw new CoreNoteInsightGenerationError("generation-failed", "Core note insights did not finish. Please try again.", { cause: error instanceof Error ? error : undefined });
    } finally {
      if (context) try {
        const releaseStartedAt = Date.now();
        console.info("[CoreInsights] Releasing model context", { requestId, noteId });
        await context.release();
        console.info("[CoreInsights] Model context released", { requestId, noteId, durationMs: Date.now() - releaseStartedAt });
      } catch (error) { console.warn("[CoreInsights] Could not release model context", { requestId, error }); }
    }
  }

  private publish(noteId: string, state: CoreInsightGenerationState): void {
    const previousStatus = this.getGenerationState(noteId).status;
    this.generationStates.set(noteId, state);
    console.info("[CoreInsights] Generation state changed", { noteId, requestId: "requestId" in state ? state.requestId : null, previousStatus, status: state.status, observerCount: this.listeners.get(noteId)?.size ?? 0 });
    this.listeners.get(noteId)?.forEach((listener) => listener(state));
  }

  private async runStage(context: LlamaContext, instruction: string, input: string, schema: object, outputTokens: number, requestId: string, stage: string): Promise<string> {
    const makeMessages = (note: string): RNLlamaOAICompatibleMessage[] => [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${instruction}\n\nNOTE:\n---\n${note}\n---` },
    ];
    const maxPrompt = CONTEXT_SIZE - outputTokens - SAFETY_TOKENS;
    let used = input;
    let messages = makeMessages(used);
    let promptTokens = await this.countTokens(context, messages);
    if (promptTokens > maxPrompt) {
      let low = 0;
      let high = input.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (await this.countTokens(context, makeMessages(input.slice(0, mid))) <= maxPrompt) low = mid;
        else high = mid - 1;
      }
      used = input.slice(0, low).trimEnd();
      messages = makeMessages(used);
      promptTokens = await this.countTokens(context, messages);
      console.warn("[CoreInsights] Input truncated by token budget", { requestId, stage, originalCharacters: input.length, usedCharacters: used.length, promptTokens, outputTokens });
    } else {
      console.info("[CoreInsights] Prompt budget ready", { requestId, stage, promptTokens, outputTokens, inputTruncated: false });
    }
    const stageStartedAt = Date.now();
    const result = await context.completion({ messages, response_format: { type: "json_schema", json_schema: { strict: true, schema } }, n_predict: outputTokens, temperature: 0 });
    const raw = result.content || result.text;
    console.info("[CoreInsights] Stage completed", { requestId, stage, durationMs: Date.now() - stageStartedAt, outputLength: raw.length, nPredict: outputTokens, temperature: 0 });
    return raw;
  }

  private async countTokens(context: LlamaContext, messages: RNLlamaOAICompatibleMessage[]): Promise<number> {
    const formatted = await context.getFormattedChat(messages, null, { jinja: true, enable_thinking: false, reasoning_format: "none" });
    return (await context.tokenize(formatted.prompt ?? "")).tokens.length;
  }

  private parseJson<T>(raw: string): T {
    try { const match = raw.match(/\{[\s\S]*\}/); return JSON.parse(match?.[0] ?? raw) as T; }
    catch (error) { throw new CoreNoteInsightGenerationError("invalid-output", "The local model returned an unreadable result. Try again or select a stronger model.", { cause: error instanceof Error ? error : undefined }); }
  }

  private parse(noteId: string, modelId: string, content: ContentOutput, parsed: IntentOutput, requestId: string, reference: Date, referenceIso: string, deviceTimezone: string): CoreNoteInsight {
    if (typeof content.summary !== "string" || !Array.isArray(content.keyPoints) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.calendarIntents)) {
      console.warn("[CoreInsights] Incomplete structured output", { requestId });
      throw new CoreNoteInsightGenerationError("invalid-output", "The local model returned an incomplete result. Please try again.");
    }
    const now = new Date().toISOString();
    const insightId = `core-insight-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tasks = parsed.tasks.flatMap((value, index) => this.toTask(value, noteId, insightId, index, reference, referenceIso, deviceTimezone));
    const reminders = parsed.reminders.flatMap((value, index) => this.toCalendar(value, "reminder", noteId, insightId, index, reference, referenceIso, deviceTimezone));
    const calendars = parsed.calendarIntents.flatMap((value, index) => this.toCalendar(value, "calendar", noteId, insightId, reminders.length + index, reference, referenceIso, deviceTimezone));
    return new CoreNoteInsight(insightId, noteId, content.summary.trim(), this.uniqueStrings(content.keyPoints), tasks, [], [...reminders, ...calendars], modelId, now, now);
  }

  private toTask(value: unknown, noteId: string, insightId: string, index: number, reference: Date, referenceIso: string, deviceTimezone: string): CoreTask[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputTask;
    if (typeof item.title !== "string" || !item.title.trim() || !Array.isArray(item.actionItems)) return [];
    const taskTitle = item.title.trim();
    const startsAt = resolveCoreNoteTime(item.startsAtExpression, reference);
    const dueAt = resolveCoreNoteTime(item.dueAtExpression, reference);
    const taskId = `${insightId}-task-${index}`;
    const seen = new Set<string>();
    const actionItems = item.actionItems.flatMap((action, position) => {
      const result = this.toAction(action, noteId, taskId, position, reference, referenceIso, deviceTimezone);
      const key = result[0] ? this.normalized(result[0].title) : "";
      if (!key || key === this.normalized(taskTitle) || seen.has(key)) return [];
      seen.add(key);
      return result;
    }).map((action, position) => ({ ...action, position }));
    return [{ id: taskId, title: taskTitle, description: this.optional(item.description), status: "pending", startsAt: startsAt?.normalized ?? null, dueAt: dueAt?.normalized ?? null, completedAt: null, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: this.timeMetadata({ startsAt, dueAt }, referenceIso, deviceTimezone, { generatedBy: "local-llm" }), actionItems }];
  }

  private toAction(value: unknown, noteId: string, taskId: string, position: number, reference: Date, referenceIso: string, deviceTimezone: string): CoreActionItem[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputItem;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    const startsAt = resolveCoreNoteTime(item.startsAtExpression, reference);
    const dueAt = resolveCoreNoteTime(item.dueAtExpression, reference);
    return [{ id: `${taskId}-action-${position}`, taskId, position, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: startsAt?.normalized ?? null, dueAt: dueAt?.normalized ?? null, completedAt: null, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: this.timeMetadata({ startsAt, dueAt }, referenceIso, deviceTimezone, { generatedBy: "local-llm-explicit-step" }) }];
  }

  private toCalendar(value: unknown, kind: CoreCalendarIntentKind, noteId: string, insightId: string, index: number, reference: Date, referenceIso: string, deviceTimezone: string): CoreCalendarIntent[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputCalendar;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    const startsAt = resolveCoreNoteTime(item.startsAtExpression, reference);
    const endsAt = resolveCoreNoteTime(item.endsAtExpression, reference);
    const dueAt = resolveCoreNoteTime(item.dueAtExpression, reference);
    const remindAt = resolveCoreNoteTime(item.remindAtExpression, reference);
    return [{ id: `${insightId}-${kind}-${index}`, kind, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: startsAt?.normalized ?? null, endsAt: endsAt?.normalized ?? null, dueAt: dueAt?.normalized ?? null, remindAt: remindAt?.normalized ?? null, allDay: item.allDay === true, timezone: this.optional(item.timezone) ?? deviceTimezone, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: this.timeMetadata({ startsAt, endsAt, dueAt, remindAt }, referenceIso, deviceTimezone) }];
  }

  private timeMetadata(values: Record<string, ResolvedCoreNoteTime | null>, referenceTime: string, deviceTimezone: string, base: Record<string, unknown> = {}): Record<string, unknown> {
    const expressions = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null).map(([key, value]) => [key, value]));
    return { ...base, timeReference: referenceTime, deviceTimezone, timeExpressions: expressions };
  }

  private optional(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed && !EMPTY_VALUE_STRINGS.has(trimmed.toLocaleLowerCase()) ? trimmed : null;
  }
  private normalized(value: string): string { return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ""); }
  private uniqueStrings(value: unknown[]): string[] {
    const seen = new Set<string>();
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).filter((item) => { const key = this.normalized(item); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  }
}

export type CoreInsightGenerationState =
  | { status: "idle" }
  | { status: "queued" | "generating"; requestId: string; startedAt: number }
  | { status: "completed"; requestId: string; finishedAt: number }
  | { status: "failed"; requestId: string; finishedAt: number; message: string };
