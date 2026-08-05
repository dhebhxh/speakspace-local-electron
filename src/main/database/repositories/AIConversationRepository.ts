import Database from "better-sqlite3";

import { Repository } from "./Repository";
import { AIConversation } from "../../entities/AIConversation";
import { DatabaseManager } from "../DatabaseManager";

export class AIConversationRepository implements Repository<AIConversation> {

    // 现有问题说明：Repository 接口要求 number 类型 ID，但本仓储的查找、删除和存在性检查使用 string，严格类型检查下不兼容。

    private database: Database.Database;


    public constructor() {

        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
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
            entity.getUpdatedAt().toISOString()
        );
    }


    public findById(id: string): AIConversation | null {

        const statement = this.database.prepare(`
            SELECT *
            FROM ai_conversations
            WHERE id = ?
        `);


        const row = statement.get(id) as any;


        if (row === undefined) {

            return null;
        }


        return this.toAIConversation(row);
    }


    public findAll(): AIConversation[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM ai_conversations
            ORDER BY updated_at DESC
        `);


        const rows = statement.all() as any[];


        return rows.map(
            row => this.toAIConversation(row)
        );
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
            entity.getId()
        );


        return result.changes > 0;
    }


    public deleteById(id: string): boolean {

        const statement = this.database.prepare(`
            DELETE
            FROM ai_conversations
            WHERE id = ?
        `);


        const result = statement.run(id);


        return result.changes > 0;
    }


    public existsById(id: string): boolean {

        const statement = this.database.prepare(`
            SELECT 1
            FROM ai_conversations
            WHERE id = ?
            LIMIT 1
        `);


        return statement.get(id) !== undefined;
    }


    private toAIConversation(row: any): AIConversation {

        return new AIConversation(
            row.id,
            row.name,
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}
