import Database from 'better-sqlite3';

import { Repository } from './Repository';
import { KnowledgeTemplate } from '../../entities/KnowledgeTemplate';
import { DatabaseManager } from '../DatabaseManager';

// 保留命名导出，与其余 Repository 的导入方式一致。
export class KnowledgeTemplateRepository
  implements Repository<KnowledgeTemplate>
{
  private database: Database.Database;

  public constructor(database = DatabaseManager.getInstance().getDatabase()) {
    this.database = database;
  }

  public create(name: string, prompt: string): number {
    const now = new Date();

    const statement = this.database.prepare(`
            INSERT INTO knowledge_templates (
                name,
                prompt,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?)
        `);

    const result = statement.run(
      name,
      prompt,
      now.toISOString(),
      now.toISOString(),
    );

    return Number(result.lastInsertRowid);
  }

  public findById(id: number): KnowledgeTemplate | null {
    const statement = this.database.prepare(`
            SELECT *
            FROM knowledge_templates
            WHERE id = ?
        `);

    const row = statement.get(id) as any;

    if (row === undefined) {
      return null;
    }

    return KnowledgeTemplateRepository.toKnowledgeTemplate(row);
  }

  public findAll(): KnowledgeTemplate[] {
    const statement = this.database.prepare(`
            SELECT *
            FROM knowledge_templates
            ORDER BY created_at ASC
        `);

    const rows = statement.all() as any[];

    return rows.map((row) =>
      KnowledgeTemplateRepository.toKnowledgeTemplate(row),
    );
  }

  public update(id: number, name: string, prompt: string): boolean {
    const now = new Date();

    const statement = this.database.prepare(`
            UPDATE knowledge_templates
            SET
                name = ?,
                prompt = ?,
                updated_at = ?
            WHERE id = ?
        `);

    const result = statement.run(name, prompt, now.toISOString(), id);

    return result.changes > 0;
  }

  public deleteById(id: number): boolean {
    const statement = this.database.prepare(`
            DELETE
            FROM knowledge_templates
            WHERE id = ?
        `);

    return statement.run(id).changes > 0;
  }

  public existsById(id: number): boolean {
    const statement = this.database.prepare(`
            SELECT 1
            FROM knowledge_templates
            WHERE id = ?
            LIMIT 1
        `);

    return statement.get(id) !== undefined;
  }

  private static toKnowledgeTemplate(row: any): KnowledgeTemplate {
    return new KnowledgeTemplate(
      row.id,
      row.name,
      row.prompt,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }
}
