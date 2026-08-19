import Database from 'better-sqlite3';

import { AIConversation } from '@shared/entities/AIConversation';
import { Repository } from './Repository';
import { DatabaseManager } from '../DatabaseManager';

// 保留命名导出，与其余 Repository 的导入方式一致。
export class AIConversationRepository implements Repository<AIConversation> {
  private database: Database.Database;

  public constructor(database = DatabaseManager.getInstance().getDatabase()) {
    this.database = database;
  }

  public create(entity: AIConversation): void {
    const statement = this.database.prepare(`
            INSERT INTO ai_conversations (
                id,
                name,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?)
        `);

    statement.run(
      entity.getId(),
      entity.getName(),
      entity.getCreatedAt().toISOString(),
      entity.getUpdatedAt().toISOString(),
    );
  }

  /** 新会话使用数据库自增 ID，避免由调用方猜测下一个编号。 */
  public createWithName(name: string): AIConversation {
    const now = new Date();
    const statement = this.database.prepare(`
            INSERT INTO ai_conversations (name, created_at, updated_at)
            VALUES (?, ?, ?)
        `);
    const result = statement.run(name, now.toISOString(), now.toISOString());

    return new AIConversation(Number(result.lastInsertRowid), name, now, now);
  }

  public findById(id: number): AIConversation | null {
    const statement = this.database.prepare(`
            SELECT *
            FROM ai_conversations
            WHERE id = ?
        `);

    const row = statement.get(id) as any;

    if (row === undefined) {
      return null;
    }

    return AIConversationRepository.toAIConversation(row);
  }

  public findAll(): AIConversation[] {
    const statement = this.database.prepare(`
            SELECT *
            FROM ai_conversations
            ORDER BY updated_at DESC
        `);

    const rows = statement.all() as any[];

    return rows.map((row) => AIConversationRepository.toAIConversation(row));
  }

  public update(entity: AIConversation): boolean {
    const statement = this.database.prepare(`
            UPDATE ai_conversations
            SET
                name = ?,
                updated_at = ?
            WHERE id = ?
        `);

    const result = statement.run(
      entity.getName(),
      entity.getUpdatedAt().toISOString(),
      entity.getId(),
    );

    return result.changes > 0;
  }

  public deleteById(id: number): boolean {
    const statement = this.database.prepare(`
            DELETE
            FROM ai_conversations
            WHERE id = ?
        `);

    const result = statement.run(id);

    return result.changes > 0;
  }

  public existsById(id: number): boolean {
    const statement = this.database.prepare(`
            SELECT 1
            FROM ai_conversations
            WHERE id = ?
            LIMIT 1
        `);

    return statement.get(id) !== undefined;
  }

  private static toAIConversation(row: any): AIConversation {
    return new AIConversation(
      row.id,
      row.name,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }
}
