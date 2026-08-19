import { initLlama, type LlamaContext } from "llama.rn";

import {
  CoreNoteInsight,
  type CoreActionItem,
  type CoreCalendarIntent,
  type CoreCalendarIntentKind,
} from "@/domain/core-note-insight/core-note-insight";
import { CoreNoteInsightGenerationError } from "@/errors/core-note-insight-generation-error";
import { CoreNoteInsightRepository } from "@/repositories/core-note-insight-repository";
import { LlmModelService } from "@/services/llm-model-service";

type OutputItem = { title?: unknown; description?: unknown; startsAt?: unknown; dueAt?: unknown };
type OutputCalendar = OutputItem & { endsAt?: unknown; remindAt?: unknown; allDay?: unknown; timezone?: unknown };
type ModelOutput = { summary?: unknown; keyPoints?: unknown; actionItems?: unknown; reminders?: unknown; calendarIntents?: unknown };

const MODEL_CONTEXT_SIZE = 3072;
const MODEL_BATCH_SIZE = 128;
const MAX_PREDICTED_TOKENS = 1024;
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const itemProperties = { title: { type: "string" }, description: nullableString, startsAt: nullableString, dueAt: nullableString } as const;
const itemRequired = ["title", "description", "startsAt", "dueAt"];

export class CoreNoteInsightService {
  public constructor(
    private readonly repository: CoreNoteInsightRepository,
    private readonly llmModelService: LlmModelService,
  ) {}

  public getForNote(noteId: string): Promise<CoreNoteInsight | null> {
    return this.repository.findByNoteId(noteId);
  }

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
      console.info("[CoreInsights] Local LLM starting", { requestId, noteId, modelId: model.getId() });
      context = await initLlama({ model: modelFile.uri, n_ctx: MODEL_CONTEXT_SIZE, n_batch: MODEL_BATCH_SIZE });
      const inputForPrompt = input.slice(0, 8000);
      if (inputForPrompt.length < input.length) console.warn("[CoreInsights] Input truncated for context window", { requestId, originalLength: input.length, usedLength: inputForPrompt.length });
      const result = await context.completion({
        messages: [
          { role: "system", content: "Extract faithful core note insights using only the supplied note. Never invent tasks, commitments, people, dates, times, reminders, or events. Keep empty arrays when evidence is absent. Preserve the note's primary language. Return only valid JSON." },
          { role: "user", content: `Extract a concise summary, key points, action items, reminders, and calendar intents. An action item requires an explicit or clearly requested action. A reminder requires an explicit request or intent to remember/be notified. A calendar intent requires an explicit event, appointment, meeting, or scheduling intent. Do not convert ordinary facts into actions or events. Use null for any unknown optional value. Only return an ISO-8601 time when the source makes it explicit and unambiguous; otherwise use null. Return exactly the requested JSON schema.\n\nNOTE:\n---\n${inputForPrompt}\n---` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                keyPoints: { type: "array", items: { type: "string" } },
                actionItems: { type: "array", items: { type: "object", properties: itemProperties, required: itemRequired, additionalProperties: false } },
                reminders: { type: "array", items: { type: "object", properties: { ...itemProperties, remindAt: nullableString }, required: [...itemRequired, "remindAt"], additionalProperties: false } },
                calendarIntents: { type: "array", items: { type: "object", properties: { ...itemProperties, endsAt: nullableString, remindAt: nullableString, allDay: { type: "boolean" }, timezone: nullableString }, required: [...itemRequired, "endsAt", "remindAt", "allDay", "timezone"], additionalProperties: false } },
              },
              required: ["summary", "keyPoints", "actionItems", "reminders", "calendarIntents"],
              additionalProperties: false,
            },
          },
        },
        n_predict: MAX_PREDICTED_TOKENS,
        temperature: 0.1,
      });
      const raw = result.content || result.text;
      console.info("[CoreInsights] Local LLM completed", { requestId, noteId, outputLength: raw.length });
      const insight = this.parse(noteId, model.getId(), raw, requestId);
      console.info("[CoreInsights] Structured output parsed", { requestId, keyPointCount: insight.getKeyPoints().length, actionItemCount: insight.getActionItems().length, calendarIntentCount: insight.getCalendarIntents().length });
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

  private parse(noteId: string, modelId: string, raw: string, requestId: string): CoreNoteInsight {
    let parsed: ModelOutput;
    try { const match = raw.match(/\{[\s\S]*\}/); parsed = JSON.parse(match?.[0] ?? raw) as ModelOutput; }
    catch (error) { throw new CoreNoteInsightGenerationError("invalid-output", "The local model returned an unreadable result. Try again or select a stronger model.", { cause: error instanceof Error ? error : undefined }); }
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.actionItems) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.calendarIntents)) {
      console.warn("[CoreInsights] Incomplete structured output", { requestId });
      throw new CoreNoteInsightGenerationError("invalid-output", "The local model returned an incomplete result. Please try again.");
    }
    const now = new Date().toISOString();
    const insightId = `core-insight-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const actions = parsed.actionItems.flatMap((value, index) => this.toAction(value, noteId, insightId, index));
    const reminders = parsed.reminders.flatMap((value, index) => this.toCalendar(value, "reminder", noteId, insightId, index));
    const calendars = parsed.calendarIntents.flatMap((value, index) => this.toCalendar(value, "calendar", noteId, insightId, reminders.length + index));
    return new CoreNoteInsight(insightId, noteId, parsed.summary.trim(), this.strings(parsed.keyPoints), actions, [...reminders, ...calendars], modelId, now, now);
  }

  private toAction(value: unknown, noteId: string, insightId: string, index: number): CoreActionItem[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputItem;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    return [{ id: `${insightId}-action-${index}`, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: this.optional(item.startsAt), dueAt: this.optional(item.dueAt), completedAt: null, sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: {} }];
  }

  private toCalendar(value: unknown, kind: CoreCalendarIntentKind, noteId: string, insightId: string, index: number): CoreCalendarIntent[] {
    if (!value || typeof value !== "object") return [];
    const item = value as OutputCalendar;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    return [{ id: `${insightId}-${kind}-${index}`, kind, title: item.title.trim(), description: this.optional(item.description), status: "pending", startsAt: this.optional(item.startsAt), endsAt: this.optional(item.endsAt), dueAt: this.optional(item.dueAt), remindAt: this.optional(item.remindAt), allDay: item.allDay === true, timezone: this.optional(item.timezone), sourceNoteId: noteId, externalSystem: null, externalId: null, metadata: {} }];
  }

  private optional(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private strings(value: unknown[]): string[] { return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()); }
}
