import Database from "better-sqlite3";

import { Repository } from "./Repository";
import { KnowledgeOutput } from "../../entities/KnowledgeOutput";
import { DatabaseManager } from "../DatabaseManager";

export class KnowledgeOutputRepository implements Repository<KnowledgeOutput> {

    private database: Database.Database;


    public constructor() {

        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
    }


    public create(entity: KnowledgeOutput): void {

        const statement = this.database.prepare(`
            INSERT INTO knowledge_outputs (
                id,
                note_id,
                template_id,
                content_type,
                content,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);


        statement.run(
            entity.getId(),
            entity.getNoteId(),
            entity.getTemplateId(),
            entity.getContentType(),
            entity.getContent(),
            entity.getCreatedAt().toISOString(),
            entity.getUpdatedAt().toISOString()
        );
    }


    public findById(id: number): KnowledgeOutput | null {

        const statement = this.database.prepare(`
            SELECT *
            FROM knowledge_outputs
            WHERE id = ?
        `);


        const row = statement.get(id) as any;


        if (row === undefined) {

            return null;
        }


        return this.toKnowledgeOutput(row);
    }


    public findAllByNote(
        noteId: string
    ): KnowledgeOutput[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM knowledge_outputs
            WHERE note_id = ?
        `);


        const rows = statement.all(noteId) as any[];


        return rows.map(
            row => this.toKnowledgeOutput(row)
        );
    }


    public findAllByTemplate(
        templateId: string
    ): KnowledgeOutput[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM knowledge_outputs
            WHERE template_id = ?
        `);


        const rows = statement.all(templateId) as any[];


        return rows.map(
            row => this.toKnowledgeOutput(row)
        );
    }


    public update(entity: KnowledgeOutput): boolean {

        const statement = this.database.prepare(`
            UPDATE knowledge_outputs
            SET
                content_type = ?,
                content = ?,
                updated_at = ?
            WHERE id = ?
        `);


        return statement.run(
            entity.getContentType(),
            entity.getContent(),
            entity.getUpdatedAt().toISOString(),
            entity.getId()
        ).changes > 0;
    }


    public deleteById(id: number): boolean {

        return this.database.prepare(`
            DELETE
            FROM knowledge_outputs
            WHERE id = ?
        `).run(id).changes > 0;
    }


    public existsById(id: number): boolean {

        return this.database.prepare(`
            SELECT 1
            FROM knowledge_outputs
            WHERE id = ?
        `).get(id) !== undefined;
    }


    private toKnowledgeOutput(row: any): KnowledgeOutput {

        return new KnowledgeOutput(
            row.id,
            row.note_id,
            row.template_id,
            row.content_type,
            row.content,
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}
