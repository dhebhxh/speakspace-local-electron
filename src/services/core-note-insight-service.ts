import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from "llama.rn";

import { CoreNoteInsight, type CoreActionItem, type CoreCalendarIntent, type CoreCalendarIntentKind, type CoreTask } from "@/domain/core-note-insight/core-note-insight";
import { CoreNoteInsightGenerationError } from "@/errors/core-note-insight-generation-error";
import { CoreNoteInsightRepository } from "@/repositories/core-note-insight-repository";
import { LlmModelService } from "@/services/llm-model-service";

type OutputItem = { title?: unknown; description?: unknown; startsAt?: unknown; dueAt?: unknown };
type OutputCalendar = OutputItem & { endsAt?: unknown; remindAt?: unknown; allDay?: unknown; timezone?: unknown };
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
- Copy an ISO-8601 value only when NOTE itself supplies one unambiguously. Otherwise use null; never calculate or guess.
- Keep missing people, place, timezone, date, and time unknown.
- For an unknown optional field, output the JSON literal null. Never output the strings "null", "unknown", "undefined", "N/A", or "none".

Silently test every candidate against these rules before answering. Do not output that analysis.`;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const itemProperties = { title: { type: "string" }, description: nullableString, startsAt: nullableString, dueAt: nullableString } as const;
const itemRequired = ["title", "description", "startsAt", "dueAt"];
const contentSchema = { type: "object", properties: { summary: { type: "string" }, keyPoints: { type: "array", items: { type: "string" } } }, required: ["summary", "keyPoints"], additionalProperties: false } as const;
const intentSchema = {
  type: "object",
  properties: {
    tasks: { type: "array", items: { type: "object", properties: { ...itemProperties, actionItems: { type: "array", items: { type: "object", properties: itemProperties, required: itemRequired, additionalProperties: false } } }, required: [...itemRequired, "actionItems"], additionalProperties: false } },
    reminders: { type: "array", items: { type: "object", properties: { ...itemProperties, remindAt: nullableString }, required: [...itemRequired, "remindAt"], additionalProperties: false } },
    calendarIntents: { type: "array", items: { type: "object", properties: { ...itemProperties, endsAt: nullableString, remindAt: nullableString, allDay: { type: "boolean" }, timezone: nullableString }, required: [...itemRequired, "endsAt", "remindAt", "allDay", "timezone"], additionalProperties: false } },
  },
  required: ["tasks", "reminders", "calendarIntents"], additionalProperties: false,
} as const;

export class CoreNoteInsightService {
  public constructor(private readonly repository: CoreNoteInsightRepository, private readonly llmModelService: LlmModelService) {}
  public getForNote(noteId: string): Promise<CoreNoteInsight | null> { return this.repository.findByNoteId(noteId); }

  public async generate(noteId: string, transcript: string): Promise<CoreNoteInsight> {
    const requestId = `core-insights-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      const contentRaw = await this.runStage(context, CONTENT_PROMPT, input, contentSchema, CONTENT_TOKENS, requestId, "content");
      const content = this.parseJson<ContentOutput>(contentRaw);
      const intentRaw = await this.runStage(context, INTENT_PROMPT, input, intentSchema, INTENT_TOKENS, requestId, "intent");
      const intents = this.parseJson<IntentOutput>(intentRaw);
      const insight = this.parse(noteId, model.getId(), content, intents, requestId);
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
      if (context) try { await context.release(); } catch (error) { console.warn("[CoreInsights] Could not release model context", { requestId, error }); }
    }
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

  private parse(noteId: string, modelId: string, content: ContentOutput, parsed: IntentOutput, requestId: string): CoreNoteInsight {
    if (typeof content.summary !== "string" || !Array.isArray(content.keyPoints) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.calendarIntents)) {
      console.warn("[CoreInsights] Incomplete structured output", { requestId });
      throw new CoreNoteInsightGenerationError("invalid-output", "The local model returned an incomplete result. Please try again.");
    }
    const now = new Date().toISOString();
    const insightId = `core-insight-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tasks = parsed.tasks.flatMap((value, index) => this.toTask(value, noteId, insightId, index));
    const reminders = parsed.reminders.flatMap((value, index) => this.toCalendar(value, "reminder", noteId, insightId, index));
    const calendars = parsed.calendarIntents.flatMap((value, index) => this.toCalendar(value, "calendar", noteId, insightId, reminders.length + index));
    return new CoreNoteInsight(insightId, noteId, content.summary.trim(), this.uniqueStrings(content.keyPoints), tasks, [], [...reminders, ...calendars], modelId, now, now);
  }

  private toTask(value: unknown, noteId: string, insightId: string, index: number): CoreTask[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputTask;
    if (typeof item.title !== "string" || !item.title.trim() || !Array.isArray(item.actionItems)) return [];
    const taskTitle = item.title.trim();
    const taskId = `${insightId}-task-${index}`;
    const seen = new Set<string>();
    const actionItems = item.actionItems.flatMap((action, position) => {
      const result = this.toAction(action, noteId, taskId, position);
      const key = result[0] ? this.normalized(result[0].title) : "";
      if (!key || key === this.normalized(taskTitle) || seen.has(key)) return [];
      seen.add(key);
      return result;
    }).map((action, position) => ({ ...action, position }));
    return [{ id: taskId, title: taskTitle, description: this.optional(item.description), status: "pending", startsAt: this.optional(item.startsAt), dueAt: this.optional(item.dueAt), completedAt: null, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: { generatedBy: "local-llm" }, actionItems }];
  }

  private toAction(value: unknown, noteId: string, taskId: string, position: number): CoreActionItem[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputItem;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    return [{ id: `${taskId}-action-${position}`, taskId, position, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: this.optional(item.startsAt), dueAt: this.optional(item.dueAt), completedAt: null, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: { generatedBy: "local-llm-explicit-step" } }];
  }

  private toCalendar(value: unknown, kind: CoreCalendarIntentKind, noteId: string, insightId: string, index: number): CoreCalendarIntent[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputCalendar;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    return [{ id: `${insightId}-${kind}-${index}`, kind, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: this.optional(item.startsAt), endsAt: this.optional(item.endsAt), dueAt: this.optional(item.dueAt), remindAt: this.optional(item.remindAt), allDay: item.allDay === true, timezone: this.optional(item.timezone), sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: {} }];
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
