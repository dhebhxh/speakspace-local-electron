import Database from "better-sqlite3";

import { Repository } from "./Repository";
import { AIMessage } from "../../entities/AIMessage";
import { DatabaseManager } from "../DatabaseManager";


export class AIMessageRepository implements Repository<AIMessage> {

    private database: Database.Database;


    public constructor() {

        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
    }


    public create(entity: AIMessage): void {

        const statement = this.database.prepare(`
            INSERT INTO ai_messages (
                id,
                conversation_id,
                role,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        `);


        statement.run(
            entity.getId(),
            entity.getConversationId(),
            entity.getRole(),
            entity.getContent(),
            entity.getCreatedAt().toISOString()
        );
    }


    public findById(id: string): AIMessage | null {

        const statement = this.database.prepare(`
            SELECT *
            FROM ai_messages
            WHERE id = ?
        `);


        const row = statement.get(id) as any;


        if (row === undefined) {

            return null;
        }


        return this.toAIMessage(row);
    }


    public findAllByConversation(
        conversationId: string
    ): AIMessage[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM ai_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        `);


        const rows =
            statement.all(conversationId) as any[];


        return rows.map(
            row => this.toAIMessage(row)
        );
    }


    public update(entity: AIMessage): boolean {

        const statement = this.database.prepare(`
            UPDATE ai_messages
            SET
                role = ?,
                content = ?
            WHERE id = ?
        `);


        const result = statement.run(
            entity.getRole(),
            entity.getContent(),
            entity.getId()
        );


        return result.changes > 0;
    }


    public deleteById(id: string): boolean {

        const statement = this.database.prepare(`
            DELETE
            FROM ai_messages
            WHERE id = ?
        `);


        const result = statement.run(id);


        return result.changes > 0;
    }


    public existsById(id: string): boolean {

        const statement = this.database.prepare(`
            SELECT 1
            FROM ai_messages
            WHERE id = ?
            LIMIT 1
        `);


        return statement.get(id) !== undefined;
    }


    private toAIMessage(row: any): AIMessage {

        return new AIMessage(
            row.id,
            row.conversation_id,
            row.role,
            row.content,
            new Date(row.created_at)
        );
    }
}