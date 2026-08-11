import Database from 'better-sqlite3';

import { Repository } from './Repository';
import { Note } from '../../entities/Note';
import { DatabaseManager } from '../DatabaseManager';

export class NoteRepository implements Repository<Note> {
  private database: Database.Database;

  public constructor() {
    const dbManager = DatabaseManager.getInstance();
    this.database = dbManager.getDatabase();
  }

  public create(entity: Note): number {
    // 现有问题说明：INSERT 只有 8 个字段和占位符，但下方传入了 9 个值（多传 entity.getId()），参数会整体错位并导致创建失败。
    // 现有问题说明：方法声明返回 number，但当前实现没有 return，调用方无法取得新笔记 ID。

    const now = new Date();

    const statement = this.database.prepare(`
            INSERT INTO notes (
                workspace_id,
                name,
                audio_relative_path,
                transcript,
                is_pinned,
                pinned_at,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

    statement.run(
      entity.getId(),
      entity.getWorkspaceId(),
      entity.getName(),
      entity.getAudioRelativePath(),
      entity.getTranscript(),
      entity.isPinned() ? 1 : 0,
      entity.getPinnedAt() ? entity.getPinnedAt()?.toISOString() : null,
      entity.getCreatedAt().toISOString(),
      entity.getUpdatedAt().toISOString(),
    );
  }

  public findById(id: number): Note | null {
    const statement = this.database.prepare(`
            SELECT *
            FROM notes
            WHERE id = ?
        `);

    const row = statement.get(id) as any;

    if (row === undefined) {
      return null;
    }

    return this.toNote(row);
  }

  public findAllByWorkspace(workspaceId: string): Note[] {
    const statement = this.database.prepare(`
            SELECT *
            FROM notes
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
        `);

    const rows = statement.all(workspaceId) as any[];

    return rows.map((row) => this.toNote(row));
  }

  public update(entity: Note): boolean {
    const statement = this.database.prepare(`
            UPDATE notes
            SET
                workspace_id = ?,
                name = ?,
                audio_relative_path = ?,
                transcript = ?,
                is_pinned = ?,
                pinned_at = ?,
                updated_at = ?
            WHERE id = ?
        `);

    const result = statement.run(
      entity.getWorkspaceId(),
      entity.getName(),
      entity.getAudioRelativePath(),
      entity.getTranscript(),
      entity.isPinned() ? 1 : 0,
      entity.getPinnedAt() ? entity.getPinnedAt()?.toISOString() : null,
      entity.getUpdatedAt().toISOString(),
      entity.getId(),
    );

    return result.changes > 0;
  }

  public deleteById(id: number): boolean {
    const statement = this.database.prepare(`
            DELETE
            FROM notes
            WHERE id = ?
        `);

    const result = statement.run(id);

    return result.changes > 0;
  }

  public existsById(id: number): boolean {
    const statement = this.database.prepare(`
            SELECT 1
            FROM notes
            WHERE id = ?
            LIMIT 1
        `);

    return statement.get(id) !== undefined;
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
}
