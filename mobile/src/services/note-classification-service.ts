import { initLlama, type LlamaContext } from "llama.rn";

import {
  buildCategoryPrompt,
  parseCategory,
  type NoteCategory,
} from "@/constants/note-categories";
import { NoteRepository } from "@/repositories/note-repository";
import { LlmModelService } from "@/services/llm-model-service";
import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";

export type NoteCategoryChange = { noteId: string; category: NoteCategory };
type NoteCategoryChangeListener = (change: NoteCategoryChange) => void;

export class NoteClassificationService {
  private readonly listeners = new Set<NoteCategoryChangeListener>();

  public constructor(
    private readonly noteRepository: NoteRepository,
    private readonly llmModelService: LlmModelService,
    private readonly coordinator: LocalLlmCoordinator,
  ) {}

  public async classifyNote(noteId: string): Promise<NoteCategory | null> {
    const note = await this.noteRepository.findById(noteId);
    if (!note || note.getTranscript().trim().length === 0) return null;
    const category = await this.classifyTranscript(note.getTranscript());
    if (!category) return null;
    const saved = await this.noteRepository.updateCategoryIfUnchanged(
      noteId,
      category,
      note.getUpdatedAt(),
    );
    if (saved) this.publish({ noteId, category });
    return saved ? category : null;
  }

  public subscribe(listener: NoteCategoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async classifyTranscript(transcript: string): Promise<NoteCategory | null> {
    try {
      const model = await this.llmModelService.getActiveModel();
      if (!model) return null;
      const file = this.llmModelService.resolveModelFile(model);
      if (!file.exists) return null;
      return this.coordinator.runExclusive("note-classification", async () => {
        let context: LlamaContext | null = null;
        try {
          context = await initLlama({ model: file.uri, n_ctx: 2_048, n_batch: 64 });
          const result = await context.completion({
            messages: [{ role: "user", content: buildCategoryPrompt(transcript) }],
            n_predict: 16,
            temperature: 0,
          });
          return parseCategory(result.content || result.text);
        } finally {
          if (context) await context.release().catch(() => undefined);
        }
      });
    } catch (error) {
      console.warn("[NoteCategory] Automatic classification failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private publish(change: NoteCategoryChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.warn("[NoteCategory] Classification listener failed", {
          noteId: change.noteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
