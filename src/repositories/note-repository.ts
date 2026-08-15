import { DatabaseManager } from "@/database";
import { Note } from "@/domain/note/note";
import { DatabaseError } from "@/errors/database-error";

type NoteRow = {
  id: string;
  workspace_id: string | null;
  name: string | null;
  audio_relative_path: string | null;
  transcript: string;
  is_pinned: number;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
};

export class NoteRepository {
  public constructor(private readonly databaseManager: DatabaseManager) {}

  public async findById(id: string): Promise<Note | null> {
    try {
      const row = await this.databaseManager
        .getDatabase()
        .getFirstAsync<NoteRow>(
          `SELECT id, workspace_id, name, audio_relative_path, transcript,
            is_pinned, pinned_at, created_at, updated_at
           FROM notes
           WHERE id = ?`,
          id,
        );

      return row && row.workspace_id ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw this.toDatabaseError("Unable to load the note.", error);
    }
  }

  public async findByWorkspaceId(workspaceId: string): Promise<Note[]> {
    try {
      const rows = await this.databaseManager
        .getDatabase()
        .getAllAsync<NoteRow>(
          `SELECT id, workspace_id, name, audio_relative_path, transcript,
            is_pinned, pinned_at, created_at, updated_at
           FROM notes
           WHERE workspace_id = ?
           ORDER BY updated_at DESC`,
          workspaceId,
        );

      return rows
        .filter((row) => row.workspace_id !== null)
        .map((row) => this.mapRowToEntity(row));
    } catch (error) {
      throw this.toDatabaseError("Unable to load notes.", error);
    }
  }

  public async create(note: Note): Promise<void> {
    try {
      await this.databaseManager.getDatabase().runAsync(
        `INSERT INTO notes (
          id, workspace_id, name, audio_relative_path, transcript,
          is_pinned, pinned_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        note.getId(),
        note.getWorkspaceId(),
        note.getName(),
        note.getAudioRelativePath(),
        note.getTranscript(),
        note.getIsPinned() ? 1 : 0,
        note.getPinnedAt(),
        note.getCreatedAt(),
        note.getUpdatedAt(),
      );
    } catch (error) {
      throw this.toDatabaseError("Unable to create the note.", error);
    }
  }

  public async update(note: Note): Promise<void> {
    try {
      await this.databaseManager.getDatabase().runAsync(
        `UPDATE notes SET
          name = ?, transcript = ?, is_pinned = ?, pinned_at = ?, updated_at = ?
         WHERE id = ?`,
        note.getName(),
        note.getTranscript(),
        note.getIsPinned() ? 1 : 0,
        note.getPinnedAt(),
        note.getUpdatedAt(),
        note.getId(),
      );
    } catch (error) {
      throw this.toDatabaseError("Unable to update the note.", error);
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await this.databaseManager
        .getDatabase()
        .runAsync("DELETE FROM notes WHERE id = ?", id);
    } catch (error) {
      throw this.toDatabaseError("Unable to delete the note.", error);
    }
  }

  private mapRowToEntity(row: NoteRow): Note {
    if (row.workspace_id === null) {
      throw new DatabaseError("Note has no workspace relationship.");
    }

    return new Note(
      row.id,
      row.workspace_id,
      row.name,
      row.audio_relative_path,
      row.transcript,
      row.is_pinned === 1,
      row.pinned_at,
      row.created_at,
      row.updated_at,
    );
  }

  private toDatabaseError(message: string, error: unknown): DatabaseError {
    return new DatabaseError(message, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}
