import { initLlama, type LlamaContext } from "llama.rn";

import { getKnowledgeScenarioDefinition } from "@/constants/knowledge-scenarios";
import { KnowledgeDocument, type KnowledgeScenario, type KnowledgeSection } from "@/domain/knowledge/knowledge-document";
import { KnowledgeGenerationError } from "@/errors/knowledge-generation-error";
import { KnowledgeDocumentRepository } from "@/repositories/knowledge-document-repository";
import { LlmModelService } from "@/services/llm-model-service";

type ModelOutput = { summary?: unknown; sections?: Record<string, unknown> };

const MODEL_CONTEXT_SIZE = 3072;
const MODEL_BATCH_SIZE = 128;
const MAX_PREDICTED_TOKENS = 768;

export class KnowledgeService {
  public constructor(
    private readonly repository: KnowledgeDocumentRepository,
    private readonly llmModelService: LlmModelService,
  ) {}

  public getForNote(noteId: string): Promise<KnowledgeDocument | null> {
    return this.repository.findByNoteId(noteId);
  }

  public async generate(noteId: string, transcript: string, scenario: KnowledgeScenario): Promise<KnowledgeDocument> {
    const normalizedTranscript = transcript.trim();
    if (!normalizedTranscript) {
      throw new KnowledgeGenerationError("empty-transcript", "This note has no transcript to organize yet.");
    }

    console.info("[Knowledge] Generation requested", { noteId, scenario, transcriptLength: normalizedTranscript.length });
    const model = await this.llmModelService.getActiveModel();
    if (!model) {
      console.warn("[Knowledge] No active local LLM", { noteId });
      throw new KnowledgeGenerationError("model-unavailable", "Choose and activate a local language model in AI Models first.");
    }
    const modelFile = this.llmModelService.resolveModelFile(model);
    if (!modelFile.exists) {
      console.warn("[Knowledge] Active model file is missing", { modelId: model.getId() });
      throw new KnowledgeGenerationError("model-file-missing", "The active model file is missing. Reinstall it from AI Models.");
    }

    let context: LlamaContext | null = null;
    try {
      console.info("[Knowledge] Loading local model", { modelId: model.getId(), modelName: model.getName() });
      context = await initLlama({
        model: modelFile.uri,
        n_ctx: MODEL_CONTEXT_SIZE,
        n_batch: MODEL_BATCH_SIZE,
      });
      console.info("[Knowledge] Local model loaded", { modelId: model.getId() });
      const definition = getKnowledgeScenarioDefinition(scenario);
      const transcriptForPrompt = normalizedTranscript.slice(0, 8000);
      if (transcriptForPrompt.length < normalizedTranscript.length) {
        console.warn("[Knowledge] Transcript truncated for local context window", { originalLength: normalizedTranscript.length, usedLength: transcriptForPrompt.length });
      }
      const sectionShape = Object.fromEntries(definition.sections.map((section) => [section.key, []]));
      const sectionProperties = Object.fromEntries(definition.sections.map((section) => [
        section.key,
        { type: "array", items: { type: "string" } },
      ]));
      const sectionGuide = definition.sections
        .map((section) => `- ${section.key}: ${section.instruction}`)
        .join("\n");
      console.info("[Knowledge] Starting local completion", { modelId: model.getId(), scenario });
      const result = await context.completion({
        messages: [
          { role: "system", content: "You organize transcripts into faithful, concise knowledge notes. Use only information in the transcript. Never invent names, owners, dates, decisions, quotes, or facts. Use the transcript's primary language. Return only valid JSON." },
          { role: "user", content: `Create a ${definition.name} knowledge note. Return exactly this JSON shape: {\"summary\":\"a concise overview\",\"sections\":${JSON.stringify(sectionShape)}}. Every section value must be an array of concise strings. Use [] when the transcript has no evidence for a section. Section requirements:\n${sectionGuide}\nTranscript:\n---\n${transcriptForPrompt}\n---` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                sections: {
                  type: "object",
                  properties: sectionProperties,
                  required: definition.sections.map((section) => section.key),
                  additionalProperties: false,
                },
              },
              required: ["summary", "sections"],
              additionalProperties: false,
            },
          },
        },
        n_predict: MAX_PREDICTED_TOKENS,
        temperature: 0.2,
      });
      const document = this.toDocument(noteId, scenario, model.getId(), result.content || result.text);
      await this.repository.save(document);
      console.info("[Knowledge] Generation completed and saved", { noteId, scenario, modelId: model.getId(), sectionCount: document.getSections().length });
      return document;
    } catch (error) {
      if (error instanceof KnowledgeGenerationError) throw error;
      console.error("[Knowledge] Generation failed", { noteId, scenario, error });
      throw new KnowledgeGenerationError("generation-failed", "Knowledge generation did not finish. Please try again.", { cause: error instanceof Error ? error : undefined });
    } finally {
      if (context) {
        try { await context.release(); } catch (error) { console.warn("[Knowledge] Could not release model context", error); }
      }
    }
  }

  private toDocument(noteId: string, scenario: KnowledgeScenario, modelId: string, raw: string): KnowledgeDocument {
    let parsed: ModelOutput;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? raw) as ModelOutput;
    } catch (error) {
      console.warn("[Knowledge] Model returned invalid JSON", { preview: raw.slice(0, 300) });
      throw new KnowledgeGenerationError("invalid-output", "The local model returned an unreadable result. Try again or select a stronger model.", { cause: error instanceof Error ? error : undefined });
    }
    if (typeof parsed.summary !== "string" || !parsed.sections || typeof parsed.sections !== "object") {
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
    return new KnowledgeDocument(`knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}`, noteId, scenario, parsed.summary.trim(), sections, modelId, now, now);
  }
}
