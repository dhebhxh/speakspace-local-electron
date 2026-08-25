import { type LlamaContext, type RNLlamaOAICompatibleMessage } from "llama.rn";

import { CoreNoteInsight, type CoreActionItem, type CoreCalendarIntent, type CoreCalendarIntentKind, type CoreTask } from "@/domain/core-note-insight/core-note-insight";
import { CoreNoteInsightGenerationError } from "@/errors/core-note-insight-generation-error";
import { CoreNoteInsightRepository } from "@/repositories/core-note-insight-repository";
import {
  completionHitOutputLimit,
  extractFirstJsonObject,
  fallbackContentFromTranscript,
  runAdaptiveStructuredBatches,
  sanitizeAdaptiveIntentBatches,
  splitIntentTranscript,
  type AdaptiveCompletionMode,
  type StructuredStageResult,
} from "@/services/core-note-insight-generation-policy";
import { getLocalReferenceTime, resolveCoreNoteTime, type ResolvedCoreNoteTime } from "@/services/core-note-time";
import { LlmModelService } from "@/services/llm-model-service";
import { InferenceCancelledError, type InferenceTask, type InferenceTaskContext, LocalLlmCoordinator } from "@/services/local-llm-coordinator";
import { LlmRequestService } from "@/services/llm-request-service";
import { extractStreamingObjectStringFields, extractStreamingString, extractStreamingStringArray } from "@/services/structured-stream-preview";
import {
  annotateTaskRecurrences,
  normalizeTaskRecurrence,
  recurrenceValue,
  recurringSeriesKey,
  stripTaskRecurrenceAnnotations,
} from "@/services/task-recurrence";

type OutputItem = { title?: unknown; description?: unknown; startsAtExpression?: unknown; dueAtExpression?: unknown };
type OutputCalendar = OutputItem & { endsAtExpression?: unknown; remindAtExpression?: unknown; allDay?: unknown; timezone?: unknown };
type OutputTask = OutputItem & { actionItems?: unknown; recurrence?: unknown };
type ContentOutput = { summary?: unknown; keyPoints?: unknown };
type IntentOutput = { tasks?: unknown; reminders?: unknown; calendarIntents?: unknown };
type StructuredOutput = ContentOutput & IntentOutput;

const CONTEXT_SIZE = 6144;
const CONTENT_TOKENS = 1536;
const CONTENT_RETRY_TOKENS = 2304;
const INTENT_TOKENS = 1536;
const INTENT_RETRY_TOKENS = 2304;
const STRUCTURED_TOKENS = 3072;
const SAFETY_TOKENS = 192;
const EMPTY_VALUE_STRINGS = new Set(["null", "unknown", "undefined", "none", "n/a", "na", "not specified", "unspecified"]);
const SYSTEM = `Perform grounded summarization and extraction from the user's NOTE.
Use only information supported by NOTE. You may compress, reorder, merge repetition, and state relationships explicit in context. Never add outside knowledge or invent facts, people, commands, decisions, dates, times, places, tasks, reminders, or events. Preserve uncertainty and the note's primary language. Empty categories must stay empty. Return only JSON matching the schema.`;
const CONTENT_PROMPT = `Produce an information summary and concrete key points.

SUMMARY
- Answer: what must the user know to understand this note without rereading it?
- Use coherent, complete sentences with necessary context. It is not a title, topic label, or vague one-line description.
- Compress instead of retelling every sentence. Keep the summary within 180 words or 500 Chinese characters.

KEY POINTS
- Each item states one specific supported fact, explanation, cause/effect, condition, limitation, conclusion, decision, method, caution, or consequential detail.
- Say what the note says about a subject, not merely that it discusses the subject.
- Keep each item concise: use one short, self-contained sentence and include only one main point.
- Prefer 3 to 5 key points for an ordinary note. Use 1 or 2 when the note contains little meaningful information, and use more only when the content is genuinely complex.
- Never return more than 6 key points.
- Merge semantically related information instead of extracting sentence by sentence.
- Prefer direct wording. Remove setup, repetition, filler, examples, secondary details, repeated explanations, and details already clear from another key point.
- Include a key point only when omitting it would materially reduce the user's understanding of the note.
- Avoid semantic duplicates and do not turn examples into general facts.

Silently identify important propositions and check coverage before answering. Do not output that analysis.`;
const INTENT_PROMPT = `Classify only genuine action and time intent. Accuracy and empty arrays are more important than filling fields.

TASKS
- Include only an action the note explicitly assigns, requests, commits to, or clearly leaves to be done.
- Exclude facts, explanations, unaccepted advice, examples, tutorials/demonstrations, completed actions, and descriptions of how something generally works.
- A dated statement about work that already happened is still a fact, not a task or calendar event.
- An action verb alone does not imply a task.
- actionItems may contain only distinct steps explicitly present in NOTE. Never invent a plan. Use [] when no separate steps were stated.
- Do not duplicate a task title as an action item or create redundant parent/child wording.
- For an explicitly recurring task, set recurrence to daily, weekdays, weekly,
  biweekly, or monthly. Otherwise use null. Do not infer recurrence from one date.
- Recurring phrases are pre-annotated as phrase(YYYY-MM-DD, REPEAT=kind).
  Copy that date into dueAtExpression and kind into recurrence. Never invent a
  recurrence without this annotation, and omit the annotation from the title.

REMINDERS
- Include only an explicit intent to remember or be notified, not something that merely seems worth remembering.

CALENDAR INTENTS
- Include only an explicit event, appointment, meeting, or scheduling intent. A time expression alone is not an event and does not imply a meeting.
- Never convert dated research, review, design, preparation, testing, or other completed work into calendar events.
- Put each supported item in its single best-fitting category. Do not duplicate one fact across categories.

TIME FIELDS
- Copy the exact natural-language time phrase from NOTE into the matching *Expression field.
- Do not calculate calendar dates or convert relative expressions to ISO; the application does that from REFERENCE TIME.
- Use JSON null when NOTE provides no expression for a field. Never invent a year, month, day, clock time, end time, or timezone.
- Keep words such as "around", "afternoon", and "evening" in the copied expression.
- For an unknown optional field, output the JSON literal null. Never output the strings "null", "unknown", "undefined", "N/A", or "none".

Silently test every candidate against these rules before answering. Do not output that analysis.`;
const STRUCTURED_PROMPT = `${CONTENT_PROMPT}\n\n${INTENT_PROMPT}`;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const itemProperties = { title: { type: "string" }, description: nullableString, startsAtExpression: nullableString, dueAtExpression: nullableString } as const;
const itemRequired = ["title", "description", "startsAtExpression", "dueAtExpression"];
const contentSchema = { type: "object", properties: { summary: { type: "string" }, keyPoints: { type: "array", items: { type: "string" }, maxItems: 6 } }, required: ["summary", "keyPoints"], additionalProperties: false } as const;
const reminderProperties = { title: { type: "string" }, description: nullableString, remindAtExpression: nullableString } as const;
const calendarProperties = { title: { type: "string" }, description: nullableString, startsAtExpression: nullableString, endsAtExpression: nullableString, allDay: { type: "boolean" }, timezone: nullableString } as const;
const intentSchema = {
  type: "object",
  properties: {
    tasks: { type: "array", items: { type: "object", properties: { ...itemProperties, recurrence: nullableString, actionItems: { type: "array", items: { type: "object", properties: itemProperties, required: itemRequired, additionalProperties: false } } }, required: [...itemRequired, "recurrence", "actionItems"], additionalProperties: false } },
    reminders: { type: "array", items: { type: "object", properties: reminderProperties, required: ["title", "description", "remindAtExpression"], additionalProperties: false } },
    calendarIntents: { type: "array", items: { type: "object", properties: calendarProperties, required: ["title", "description", "startsAtExpression", "endsAtExpression", "allDay", "timezone"], additionalProperties: false } },
  },
  required: ["tasks", "reminders", "calendarIntents"], additionalProperties: false,
} as const;
const structuredSchema = {
  type: "object",
  properties: { ...contentSchema.properties, ...intentSchema.properties },
  required: [...contentSchema.required, ...intentSchema.required],
  additionalProperties: false,
} as const;

export class CoreNoteInsightService {
  public getDashboardItems() {
    return this.repository.findDashboardItems();
  }

  private readonly generationStates = new Map<string, CoreInsightGenerationState>();
  private readonly activeGenerations = new Map<string, Promise<CoreNoteInsight>>();
  private readonly activeTasks = new Map<string, InferenceTask<CoreNoteInsight>>();
  private currentLifecycle: InferenceTaskContext | null = null;
  private readonly listeners = new Map<string, Set<(state: CoreInsightGenerationState) => void>>();
  private readonly lastPartialPublishedAt = new Map<string, number>();

  public constructor(
    private readonly repository: CoreNoteInsightRepository,
    private readonly llmModelService: LlmModelService,
    private readonly coordinator: LocalLlmCoordinator,
    private readonly requests: LlmRequestService,
  ) {}
  public cancelGeneration(noteId: string): Promise<void> { return this.activeTasks.get(noteId)?.cancel() ?? Promise.resolve(); }
  public async ensureReady(): Promise<void> { await this.coordinator.runExclusive("core-insights", async () => { await this.requests.ensureReady(); }); }
  public getForNote(noteId: string): Promise<CoreNoteInsight | null> { return this.repository.findByNoteId(noteId); }

  public async setTaskCompleted(noteId: string, taskId: string, completed: boolean): Promise<CoreNoteInsight> {
    await this.repository.setTaskCompleted(noteId, taskId, completed);
    return this.getUpdatedInsight(noteId);
  }

  public async setTaskPinned(noteId: string, taskId: string, pinned: boolean): Promise<CoreNoteInsight> {
    await this.repository.setTaskPinned(noteId, taskId, pinned);
    return this.getUpdatedInsight(noteId);
  }

  private async getUpdatedInsight(noteId: string): Promise<CoreNoteInsight> {
    const insight = await this.repository.findByNoteId(noteId);
    if (!insight) throw new CoreNoteInsightGenerationError("invalid-output", "Structured Note is no longer available.");
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
    const task = this.coordinator.schedule("core-insights", async (lifecycle) => {
      this.publish(noteId, { status: "generating", requestId, startedAt: Date.now(), partial: emptyCoreInsightPreview("content") });
      this.currentLifecycle = lifecycle;
      try { return await this.runGeneration(noteId, transcript, requestId); }
      finally { this.currentLifecycle = null; }
    });
    const promise = task.promise;
    this.activeTasks.set(noteId, task);
    this.activeGenerations.set(noteId, promise);
    void promise.then(
      () => {
        this.activeGenerations.delete(noteId);
        this.activeTasks.delete(noteId);
        this.lastPartialPublishedAt.delete(noteId);
        this.publish(noteId, { status: "completed", requestId, finishedAt: Date.now() });
      },
      (error: unknown) => {
        this.activeGenerations.delete(noteId);
        this.activeTasks.delete(noteId);
        this.lastPartialPublishedAt.delete(noteId);
        if (error instanceof InferenceCancelledError) { this.publish(noteId, { status: "idle" }); return; }
        this.publish(noteId, { status: "failed", requestId, finishedAt: Date.now(), message: error instanceof Error ? error.message : "Structured Note did not finish. Please try again." });
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

    try {
      console.info("[CoreInsights] Local LLM starting", { requestId, noteId, modelId: model.getId(), contextSize: CONTEXT_SIZE, pipeline: "content+batched-intents" });
      const context = await this.requests.ensureReady();
      const reference = getLocalReferenceTime();
      console.info("[CoreInsights] Local time reference captured", { requestId, referenceTime: reference.localIso, timezone: reference.timezone });
      const timeContext = `${INTENT_PROMPT}\n\nREFERENCE TIME (device local clock; context only, do not copy it unless NOTE contains that time):\n${reference.localIso}\nDEVICE TIMEZONE:\n${reference.timezone}`;
      const annotatedIntentInput = annotateTaskRecurrences(input, reference.instant);
      const structuredInstruction = `${STRUCTURED_PROMPT}\n\nREFERENCE TIME (device local clock; context only, do not copy it unless NOTE contains that time):\n${reference.localIso}\nDEVICE TIMEZONE:\n${reference.timezone}\nRecurrence annotations inside NOTE are extraction hints only. Do not repeat them in summary, key points, titles, or descriptions.`;
      const primary = await this.generateStructured(context, structuredInstruction, annotatedIntentInput, requestId, noteId);
      let content: ContentOutput;
      let intents: IntentOutput;
      if (primary) {
        content = cleanStructuredContent(primary);
        intents = sanitizeAdaptiveIntentBatches({ values: [{ input: annotatedIntentInput, value: primary }], failures: [] });
        console.info("[CoreInsights] Single-stage pipeline completed", { requestId });
      } else {
        console.info("[CoreInsights] Falling back to content and batched intents", { requestId });
        this.publish(noteId, { status: "generating", requestId, startedAt, partial: emptyCoreInsightPreview("content") });
        content = await this.generateContent(context, input, requestId, noteId);
        this.publish(noteId, { status: "generating", requestId, startedAt, partial: {
          phase: "intents",
          summary: typeof content.summary === "string" ? content.summary.trim() : "",
          keyPoints: Array.isArray(content.keyPoints) ? this.uniqueStrings(content.keyPoints) : [],
          tasks: [], reminders: [], calendarIntents: [],
        } });
        intents = await this.generateIntents(context, timeContext, annotatedIntentInput, requestId, noteId, content);
      }
      const insight = this.parse(noteId, model.getId(), content, intents, requestId, reference.instant, reference.localIso, reference.timezone);
      const calendars = insight.getCalendarIntents();
      console.info("[CoreInsights] Structured output parsed", { requestId, summaryLength: insight.getSummary().length, keyPointCount: insight.getKeyPoints().length, taskCount: insight.getTasks().length, actionItemCount: insight.getActionItems().length, reminderCount: calendars.filter((x) => x.kind === "reminder").length, calendarIntentCount: calendars.filter((x) => x.kind === "calendar").length });
      this.currentLifecycle?.throwIfCancelled();
      await this.repository.save(insight);
      console.info("[CoreInsights] Saved and ready for display", { requestId, noteId, durationMs: Date.now() - startedAt });
      return insight;
    } catch (error) {
      if (error instanceof InferenceCancelledError) {
        console.info("[CoreInsights] Generation cancelled", { requestId, noteId });
        throw error;
      }
      console.error("[CoreInsights] Generation failed", { requestId, noteId, durationMs: Date.now() - startedAt, errorCode: error instanceof CoreNoteInsightGenerationError ? error.code : "unexpected", error });
      if (error instanceof CoreNoteInsightGenerationError) throw error;
      throw new CoreNoteInsightGenerationError("generation-failed", "Structured Note did not finish. Please try again.", { cause: error instanceof Error ? error : undefined });
    } finally { /* Shared runtime remains READY. */ }
  }

  private async generateContent(context: LlamaContext, input: string, requestId: string, noteId: string): Promise<ContentOutput> {
    const attempts = [
      { instruction: CONTENT_PROMPT, tokens: CONTENT_TOKENS, stage: "content" },
      {
        instruction: `${CONTENT_PROMPT}\n\nRECOVERY MODE: Return the smallest complete valid JSON object. Use one concise summary and no more than 8 key points. Close every string, array, and object.`,
        tokens: CONTENT_RETRY_TOKENS,
        stage: "content-recovery",
      },
    ];
    for (const attempt of attempts) {
      const result = await this.runStage(context, attempt.instruction, input, contentSchema, attempt.tokens, requestId, attempt.stage, (raw) => {
        this.publishStreamingPreview(noteId, () => ({ status: "generating", requestId, startedAt: Date.now(), partial: {
          phase: "content",
          summary: extractStreamingString(raw, "summary"),
          keyPoints: extractStreamingStringArray(raw, "keyPoints"),
          tasks: [], reminders: [], calendarIntents: [],
        } }));
      });
      if (result.hitOutputLimit) continue;
      try {
        const parsed = this.parseJson<ContentOutput>(result.raw);
        if (typeof parsed.summary === "string" && Array.isArray(parsed.keyPoints)) return parsed;
      } catch (error) {
        console.warn("[CoreInsights] Content JSON retry required", {
          requestId,
          stage: attempt.stage,
          errorCode: error instanceof CoreNoteInsightGenerationError ? error.code : "unexpected",
        });
      }
    }
    const fallback = fallbackContentFromTranscript(input);
    console.warn("[CoreInsights] Content generation used deterministic fallback", {
      requestId,
      summaryLength: fallback.summary.length,
      keyPointCount: fallback.keyPoints.length,
    });
    return fallback;
  }

  private async generateIntents(context: LlamaContext, instruction: string, input: string, requestId: string, noteId: string, content: ContentOutput): Promise<IntentOutput> {
    const chunks = splitIntentTranscript(input);
    const completed = { tasks: [] as string[], reminders: [] as string[], calendarIntents: [] as string[] };
    const publishIntentPreview = (raw = "", force = false) => {
      const createState = () => ({ status: "generating" as const, requestId, startedAt: Date.now(), partial: {
        phase: "intents" as const,
        summary: typeof content.summary === "string" ? content.summary.trim() : "",
        keyPoints: Array.isArray(content.keyPoints) ? this.uniqueStrings(content.keyPoints) : [],
        tasks: this.uniqueStrings([...completed.tasks, ...extractStreamingObjectStringFields(raw, "tasks", "title")]),
        reminders: this.uniqueStrings([...completed.reminders, ...extractStreamingObjectStringFields(raw, "reminders", "title")]),
        calendarIntents: this.uniqueStrings([...completed.calendarIntents, ...extractStreamingObjectStringFields(raw, "calendarIntents", "title")]),
      } });
      if (force) this.publishPreview(noteId, createState());
      else this.publishStreamingPreview(noteId, createState);
    };
    publishIntentPreview("", true);
    console.info("[CoreInsights] Intent evidence batches ready", {
      requestId,
      batchCount: chunks.length,
      inputLength: input.length,
    });
    const batches = await runAdaptiveStructuredBatches<IntentOutput>({
      inputs: chunks,
      complete: (chunk, mode) => this.runIntentStage(context, instruction, chunk, mode, requestId, publishIntentPreview),
      parse: (raw) => {
        const parsed = this.parseJson<IntentOutput>(raw);
        if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.calendarIntents)) {
          throw new CoreNoteInsightGenerationError("invalid-output", "Intent output did not contain all required arrays.");
        }
        completed.tasks.push(...parsed.tasks.map((item) => typeof item?.title === "string" ? item.title : ""));
        completed.reminders.push(...parsed.reminders.map((item) => typeof item?.title === "string" ? item.title : ""));
        completed.calendarIntents.push(...parsed.calendarIntents.map((item) => typeof item?.title === "string" ? item.title : ""));
        publishIntentPreview("", true);
        return parsed;
      },
    });
    if (batches.failures.length) {
      console.warn("[CoreInsights] Intent batches exhausted structured retries", {
        requestId,
        failedBatchCount: batches.failures.length,
        reasons: batches.failures.map((failure) => failure.reason),
        failedInputLengths: batches.failures.map((failure) => failure.input.length),
      });
    }
    const merged = sanitizeAdaptiveIntentBatches(batches);
    console.info("[CoreInsights] Intent batches merged", {
      requestId,
      successfulBatchCount: batches.values.length,
      failedBatchCount: batches.failures.length,
      taskCount: merged.tasks.length,
      reminderCount: merged.reminders.length,
      calendarIntentCount: merged.calendarIntents.length,
    });
    return merged;
  }

  private runIntentStage(
    context: LlamaContext,
    instruction: string,
    input: string,
    mode: AdaptiveCompletionMode,
    requestId: string,
    onPartial: (raw: string) => void,
  ): Promise<StructuredStageResult> {
    const recovery = mode === "expanded"
      ? "\n\nRECOVERY MODE: Return one minimal complete JSON object. Keep only directly supported pending actions, explicit reminders, and scheduled events. Empty arrays are correct. Close every string, array, and object."
      : "";
    return this.runStage(
      context,
      `${instruction}${recovery}`,
      input,
      intentSchema,
      mode === "expanded" ? INTENT_RETRY_TOKENS : INTENT_TOKENS,
      requestId,
      `intent-${mode}`,
      onPartial,
    );
  }

  private publish(noteId: string, state: CoreInsightGenerationState): void {
    const previousStatus = this.getGenerationState(noteId).status;
    this.generationStates.set(noteId, state);
    if (previousStatus !== state.status) console.info("[CoreInsights] Generation state changed", { noteId, requestId: "requestId" in state ? state.requestId : null, previousStatus, status: state.status, observerCount: this.listeners.get(noteId)?.size ?? 0 });
    this.listeners.get(noteId)?.forEach((listener) => listener(state));
  }

  private async generateStructured(context: LlamaContext, instruction: string, input: string, requestId: string, noteId: string): Promise<StructuredOutput | null> {
    const messages: RNLlamaOAICompatibleMessage[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${instruction}\n\nNOTE:\n---\n${input}\n---` },
    ];
    const promptTokens = await this.countTokens(context, messages);
    const maxPrompt = CONTEXT_SIZE - STRUCTURED_TOKENS - SAFETY_TOKENS;
    if (promptTokens > maxPrompt) {
      console.info("[CoreInsights] Single-stage pipeline skipped for long input", { requestId, promptTokens, maxPrompt, inputLength: input.length });
      return null;
    }
    this.publish(noteId, { status: "generating", requestId, startedAt: Date.now(), partial: emptyCoreInsightPreview("structured") });
    const result = await this.runStage(context, instruction, input, structuredSchema, STRUCTURED_TOKENS, requestId, "structured", (raw) => {
      this.publishStreamingPreview(noteId, () => ({ status: "generating", requestId, startedAt: Date.now(), partial: previewStructuredOutput(raw) }));
    });
    if (result.hitOutputLimit) return null;
    try {
      const parsed = this.parseJson<StructuredOutput>(result.raw);
      if (typeof parsed.summary !== "string" || !Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.calendarIntents)) return null;
      return parsed;
    } catch (error) {
      console.warn("[CoreInsights] Single-stage JSON fallback required", { requestId, errorCode: error instanceof CoreNoteInsightGenerationError ? error.code : "unexpected" });
      return null;
    }
  }

  private publishStreamingPreview(noteId: string, createState: () => Extract<CoreInsightGenerationState, { status: "generating" }>): void {
    const now = Date.now();
    if (now - (this.lastPartialPublishedAt.get(noteId) ?? 0) < 100) return;
    this.lastPartialPublishedAt.set(noteId, now);
    this.publishPreview(noteId, createState());
  }

  private publishPreview(noteId: string, state: Extract<CoreInsightGenerationState, { status: "generating" }>): void {
    const current = this.getGenerationState(noteId);
    if (current.status === "generating" && sameCoreInsightPreview(current.partial, state.partial)) return;
    this.publish(noteId, state);
  }

  private async runStage(context: LlamaContext, instruction: string, input: string, schema: object, outputTokens: number, requestId: string, stage: string, onPartial?: (raw: string) => void): Promise<StructuredStageResult> {
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
    let streamedRaw = "";
    const { result, raw } = await this.requests.complete(context, { messages, response_format: { type: "json_schema", json_schema: { strict: true, schema } }, n_predict: outputTokens, temperature: 0 }, this.currentLifecycle ?? undefined, (data) => {
      streamedRaw = data.accumulated_text ?? `${streamedRaw}${data.token ?? ""}`;
      onPartial?.(streamedRaw);
    });
    const hitOutputLimit = completionHitOutputLimit(result, outputTokens);
    console.info("[CoreInsights] Stage completed", {
      requestId,
      stage,
      durationMs: Date.now() - stageStartedAt,
      outputLength: raw.length,
      nPredict: outputTokens,
      predictedTokens: result.tokens_predicted,
      stoppedLimit: result.stopped_limit,
      stoppedEos: result.stopped_eos,
      contextFull: result.context_full,
      truncated: result.truncated,
      hitOutputLimit,
      temperature: 0,
    });
    return { raw, hitOutputLimit };
  }

  private async countTokens(context: LlamaContext, messages: RNLlamaOAICompatibleMessage[]): Promise<number> {
    return this.requests.countMessageTokens(context, messages);
  }

  private parseJson<T>(raw: string): T {
    try {
      const json = extractFirstJsonObject(raw);
      if (!json) throw new Error("No complete JSON object was returned.");
      return JSON.parse(json) as T;
    }
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
    const taskTitle = stripTaskRecurrenceAnnotations(item.title).trim();
    const startsAt = resolveCoreNoteTime(item.startsAtExpression, reference);
    const dueAt = resolveCoreNoteTime(item.dueAtExpression, reference);
    const recurrenceKind = normalizeTaskRecurrence(
      item.recurrence,
      `${taskTitle} ${this.optional(item.description) ?? ""} ${typeof item.startsAtExpression === "string" ? item.startsAtExpression : ""} ${typeof item.dueAtExpression === "string" ? item.dueAtExpression : ""}`,
    );
    const recurrenceParameter = recurrenceValue(recurrenceKind, dueAt?.normalized ?? startsAt?.normalized ?? null);
    const taskId = `${insightId}-task-${index}`;
    const seen = new Set<string>();
    const actionItems = item.actionItems.flatMap((action, position) => {
      const result = this.toAction(action, noteId, taskId, position, reference, referenceIso, deviceTimezone);
      const key = result[0] ? this.normalized(result[0].title) : "";
      if (!key || key === this.normalized(taskTitle) || seen.has(key)) return [];
      seen.add(key);
      return result;
    }).map((action, position) => ({ ...action, position }));
    return [{
      id: taskId, title: taskTitle, description: this.optional(item.description), status: "pending",
      startsAt: startsAt?.normalized ?? null, dueAt: dueAt?.normalized ?? null, completedAt: null,
      sourceNoteId: noteId, externalSystem: null, externalId: null,
      metadata: this.timeMetadata({ startsAt, dueAt }, referenceIso, deviceTimezone, { generatedBy: "local-llm" }),
      actionItems, isPinned: false, pinnedAt: null, recurrenceKind,
      recurrenceValue: recurrenceParameter,
      seriesKey: recurrenceKind ? recurringSeriesKey(noteId, taskTitle, recurrenceKind, recurrenceParameter) : null,
      occurrenceIndex: 0, isCurrent: true, endedAt: null,
    }];
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
  | { status: "queued"; requestId: string; startedAt: number }
  | { status: "generating"; requestId: string; startedAt: number; partial: CoreInsightPreview }
  | { status: "completed"; requestId: string; finishedAt: number }
  | { status: "failed"; requestId: string; finishedAt: number; message: string };

export type CoreInsightPreview = {
  phase: "structured" | "content" | "intents";
  summary: string;
  keyPoints: string[];
  tasks: string[];
  reminders: string[];
  calendarIntents: string[];
};

function emptyCoreInsightPreview(phase: CoreInsightPreview["phase"]): CoreInsightPreview {
  return { phase, summary: "", keyPoints: [], tasks: [], reminders: [], calendarIntents: [] };
}

function previewStructuredOutput(raw: string): CoreInsightPreview {
  return {
    phase: "structured",
    summary: stripTaskRecurrenceAnnotations(extractStreamingString(raw, "summary")),
    keyPoints: extractStreamingStringArray(raw, "keyPoints").map(stripTaskRecurrenceAnnotations),
    tasks: extractStreamingObjectStringFields(raw, "tasks", "title"),
    reminders: extractStreamingObjectStringFields(raw, "reminders", "title"),
    calendarIntents: extractStreamingObjectStringFields(raw, "calendarIntents", "title"),
  };
}

function cleanStructuredContent(value: StructuredOutput): ContentOutput {
  return {
    summary: typeof value.summary === "string" ? stripTaskRecurrenceAnnotations(value.summary) : value.summary,
    keyPoints: Array.isArray(value.keyPoints)
      ? value.keyPoints.map((item) => typeof item === "string" ? stripTaskRecurrenceAnnotations(item) : item)
      : value.keyPoints,
  };
}

function sameCoreInsightPreview(left: CoreInsightPreview, right: CoreInsightPreview): boolean {
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);
  return left.phase === right.phase && left.summary === right.summary
    && sameList(left.keyPoints, right.keyPoints) && sameList(left.tasks, right.tasks)
    && sameList(left.reminders, right.reminders) && sameList(left.calendarIntents, right.calendarIntents);
}
