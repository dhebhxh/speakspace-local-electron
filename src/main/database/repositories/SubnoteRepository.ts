import Database from "better-sqlite3";

import { Repository } from "./Repository";
import { Subnote } from "../../entities/Subnote";
import { DatabaseManager } from "../DatabaseManager";

export class SubnoteRepository implements Repository<Subnote> {

    // 现有问题说明：Subnote 实体 id 是 string，而数据库 subnotes.id 是 INTEGER AUTOINCREMENT；create 主动写入字符串 id 时可能发生类型冲突。

    private database: Database.Database;


    public constructor() {
    
        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
    }


    public create(entity: Subnote): void {

        const statement = this.database.prepare(`
            INSERT INTO subnotes (
                id,
                note_id,
                content_type,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        `);


        statement.run(
            entity.getId(),
            entity.getNoteId(),
            entity.getContentType(),
            entity.getContent(),
            entity.getCreatedAt().toISOString()
        );
    }


    public findById(id: string): Subnote | null {

        const statement = this.database.prepare(`
            SELECT *
            FROM subnotes
            WHERE id = ?
        `);


        const row = statement.get(id) as any;


        if (row === undefined) {

            return null;
        }


        return this.toSubnote(row);
    }


    public findAllByNote(
        noteId: string
    ): Subnote[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM subnotes
            WHERE note_id = ?
            ORDER BY created_at ASC
        `);


        const rows = statement.all(noteId) as any[];


        return rows.map(
            row => this.toSubnote(row)
        );
    }


    public update(entity: Subnote): boolean {

        const statement = this.database.prepare(`
            UPDATE subnotes
            SET
                content_type = ?,
                content = ?
            WHERE id = ?
        `);


        const result = statement.run(
            entity.getContentType(),
            entity.getContent(),
            entity.getId()
        );


        return result.changes > 0;
    }


    public deleteById(id: string): boolean {

        const statement = this.database.prepare(`
            DELETE
            FROM subnotes
            WHERE id = ?
        `);


        const result = statement.run(id);


        return result.changes > 0;
    }


    public existsById(id: string): boolean {

        const statement = this.database.prepare(`
            SELECT 1
            FROM subnotes
            WHERE id = ?
            LIMIT 1
        `);


        return statement.get(id) !== undefined;
    }


    private toSubnote(row: any): Subnote {

        return new Subnote(
            row.id,
            row.note_id,
            row.content_type,
            row.content,
            new Date(row.created_at)
        );
    }
}
