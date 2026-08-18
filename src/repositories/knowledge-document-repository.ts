import { DatabaseManager } from "@/database";
import { KnowledgeDocument, type KnowledgeScenario, type KnowledgeSection } from "@/domain/knowledge/knowledge-document";
import { DatabaseError } from "@/errors/database-error";

type KnowledgeRow = {
  id: string; note_id: string; scenario: string; summary: string;
  sections_json: string; model_id: string; created_at: string; updated_at: string;
};

export class KnowledgeDocumentRepository {
  public constructor(private readonly databaseManager: DatabaseManager) {}

  public async findByNoteId(noteId: string): Promise<KnowledgeDocument | null> {
    try {
      const row = await this.databaseManager.getDatabase().getFirstAsync<KnowledgeRow>(
        "SELECT * FROM knowledge_documents WHERE note_id = ?", noteId,
      );
      return row ? this.map(row) : null;
    } catch (error) {
      throw new DatabaseError("Unable to load generated knowledge.", { cause: error instanceof Error ? error : undefined });
    }
  }

  public async save(document: KnowledgeDocument): Promise<void> {
    try {
      await this.databaseManager.getDatabase().runAsync(
        `INSERT INTO knowledge_documents
          (id, note_id, scenario, summary, sections_json, model_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(note_id) DO UPDATE SET
          id = excluded.id, scenario = excluded.scenario, summary = excluded.summary,
          sections_json = excluded.sections_json, model_id = excluded.model_id,
          updated_at = excluded.updated_at`,
        document.getId(), document.getNoteId(), document.getScenario(), document.getSummary(),
        JSON.stringify(document.getSections()), document.getModelId(),
        document.getCreatedAt(), document.getUpdatedAt(),
      );
    } catch (error) {
      throw new DatabaseError("Unable to save generated knowledge.", { cause: error instanceof Error ? error : undefined });
    }
  }

  private map(row: KnowledgeRow): KnowledgeDocument {
    return new KnowledgeDocument(
      row.id, row.note_id, row.scenario as KnowledgeScenario, row.summary,
      JSON.parse(row.sections_json) as KnowledgeSection[], row.model_id, row.created_at, row.updated_at,
    );
  }
}
