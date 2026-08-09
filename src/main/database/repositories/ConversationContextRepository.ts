import Database from 'better-sqlite3';

import { Note } from '../../entities/Note';
import { AIConversation } from '../../entities/AIConversation';
import { DatabaseManager } from '../DatabaseManager';

export class ConversationContextRepository {
  private database: Database.Database;

  public constructor() {
    const dbManager = DatabaseManager.getInstance();
    this.database = dbManager.getDatabase();
  }

  public addContext(conversationId: number, noteId: number): void {
    const statement = this.database.prepare(`
            INSERT INTO conversation_contexts (
                conversation_id,
                note_id
            )
            VALUES (?, ?)
        `);

    statement.run(conversationId, noteId);
  }

  public removeContext(conversationId: number, noteId: number): void {
    const statement = this.database.prepare(`
            DELETE
            FROM conversation_contexts
            WHERE conversation_id = ?
            AND note_id = ?
        `);

    statement.run(conversationId, noteId);
  }

  public findAllByConversation(conversationId: number): Note[] {
    const statement = this.database.prepare(`
            SELECT notes.*
            FROM notes
            INNER JOIN conversation_contexts
            ON notes.id = conversation_contexts.note_id
            WHERE conversation_contexts.conversation_id = ?
        `);

    const rows = statement.all(conversationId) as any[];

    return rows.map((row) => this.toNote(row));
  }

  public findAllByNote(noteId: number): AIConversation[] {
    const statement = this.database.prepare(`
            SELECT ai_conversations.*
            FROM ai_conversations
            INNER JOIN conversation_contexts
            ON ai_conversations.id =
               conversation_contexts.conversation_id
            WHERE conversation_contexts.note_id = ?
        `);

    const rows = statement.all(noteId) as any[];

    return rows.map((row) => this.toAIConversation(row));
  }

  public exists(conversationId: number, noteId: number): boolean {
    const statement = this.database.prepare(`
            SELECT 1
            FROM conversation_contexts
            WHERE conversation_id = ?
            AND note_id = ?
            LIMIT 1
        `);

    return statement.get(conversationId, noteId) !== undefined;
  }

  private toNote(row: any): Note {
    return new Note(
      row.id,
      row.workspace_id,
      row.name,
      row.audio_relative_path,
      row.transcript,
      row.is_pinned === 1,
      row.pinned_at === null ? null : new Date(row.pinned_at),
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  private toAIConversation(row: any): AIConversation {
    return new AIConversation(
      row.id,
      row.name,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }
}
