import { initLlama, type LlamaContext, type RNLlamaOAICompatibleMessage } from "llama.rn";

import { getKnowledgeScenarioDefinition } from "@/constants/knowledge-scenarios";
import { KnowledgeDocument, type KnowledgeScenario, type KnowledgeSection } from "@/domain/knowledge/knowledge-document";
import { KnowledgeGenerationError } from "@/errors/knowledge-generation-error";
import { KnowledgeDocumentRepository } from "@/repositories/knowledge-document-repository";
import { LlmModelService } from "@/services/llm-model-service";

type ModelOutput = { sections?: Record<string, unknown> };

const MODEL_CONTEXT_SIZE = 6144;
const MODEL_BATCH_SIZE = 128;
const MAX_PREDICTED_TOKENS = 1792;
const CONTEXT_SAFETY_TOKENS = 192;
const SYSTEM_PROMPT = `Extract scenario-specific knowledge from NOTE. Core Note Insights separately handles summary, general key points, tasks/action items, reminders, and calendar intents; do not recreate those categories.
Use only information supported by NOTE. You may organize, combine repetition, and clearly restate supported relationships, but never add outside knowledge, new facts, opinions, conclusions, questions, or advice. Preserve uncertainty, attribution, and the note's primary language. A field with no evidence must be []. Return only JSON matching the schema.`;

export class KnowledgeService {
  public constructor(private readonly repository: KnowledgeDocumentRepository, private readonly llmModelService: LlmModelService) {}

  public getForNote(noteId: string): Promise<KnowledgeDocument | null> {
    return this.repository.findByNoteId(noteId);
  }

  public async generate(noteId: string, transcript: string, scenario: KnowledgeScenario): Promise<KnowledgeDocument> {
    const requestId = `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const generationStartedAt = Date.now();
    const input = transcript.trim();
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
      console.info("[Knowledge] Local model loaded", { requestId, modelId: model.getId(), durationMs: Date.now() - modelLoadStartedAt, contextSize: MODEL_CONTEXT_SIZE });

      const definition = getKnowledgeScenarioDefinition(scenario);
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
      let promptTokens = await this.countTokens(context, messages);
      if (promptTokens > maxPromptTokens) {
        let low = 0;
        let high = input.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (await this.countTokens(context, makeMessages(input.slice(0, middle))) <= maxPromptTokens) low = middle;
          else high = middle - 1;
        }
        usedInput = input.slice(0, low).trimEnd();
        messages = makeMessages(usedInput);
        promptTokens = await this.countTokens(context, messages);
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
      const rawOutput = result.content || result.text;
      console.info("[Knowledge] Local completion finished", { requestId, modelId: model.getId(), durationMs: Date.now() - completionStartedAt, outputLength: rawOutput.length, nPredict: MAX_PREDICTED_TOKENS, temperature: 0 });
      const document = this.toDocument(noteId, scenario, model.getId(), rawOutput, requestId);
      const itemCount = document.getSections().reduce((count, section) => count + section.items.length, 0);
      console.info("[Knowledge] Model output parsed", { requestId, sectionCount: document.getSections().length, itemCount });
      await this.repository.save(document);
      console.info("[Knowledge] Generation completed", { requestId, noteId, scenario, modelId: model.getId(), totalDurationMs: Date.now() - generationStartedAt, itemCount });
      return document;
    } catch (error) {
      console.error("[Knowledge] Generation failed", { requestId, noteId, scenario, durationMs: Date.now() - generationStartedAt, errorCode: error instanceof KnowledgeGenerationError ? error.code : "unexpected", error });
      if (error instanceof KnowledgeGenerationError) throw error;
      throw new KnowledgeGenerationError("generation-failed", "Knowledge generation did not finish. Please try again.", { cause: error instanceof Error ? error : undefined });
    } finally {
      if (context) try { await context.release(); } catch (error) { console.warn("[Knowledge] Could not release model context", { requestId, error }); }
    }
  }

  private async countTokens(context: LlamaContext, messages: RNLlamaOAICompatibleMessage[]): Promise<number> {
    const formatted = await context.getFormattedChat(messages, null, { jinja: true, enable_thinking: false, reasoning_format: "none" });
    return (await context.tokenize(formatted.prompt ?? "")).tokens.length;
  }

  private toDocument(noteId: string, scenario: KnowledgeScenario, modelId: string, raw: string, requestId: string): KnowledgeDocument {
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
    const definition = getKnowledgeScenarioDefinition(scenario);
    const sections: KnowledgeSection[] = definition.sections.map((section) => ({
      key: section.key,
      title: section.title,
      items: Array.isArray(parsed.sections?.[section.key])
        ? (parsed.sections[section.key] as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : [],
    }));
    const now = new Date().toISOString();
    // Keep the legacy database column empty for compatibility; scenario knowledge no longer owns a summary.
    return new KnowledgeDocument(`knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}`, noteId, scenario, "", sections, modelId, now, now);
  }
}
