import Database from "better-sqlite3";

import { Repository } from "./Repository";
import { Workspace } from "../../entities/Workspace";
import { DatabaseManager } from"../DatabaseManager";


export class WorkspaceRepository implements Repository<Workspace> {

    private database: Database.Database;


    public constructor() {

        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
    }


    public create(entity: Workspace): void {

        const statement = this.database.prepare(`
            INSERT INTO workspaces (
                id,
                name,·
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


    public findById(id: number): Workspace | null {

        const statement = this.database.prepare(`
            SELECT *
            FROM workspaces
            WHERE id = ?
        `);

        const row = statement.get(id) as any;

        if (row === undefined) {
            return null;
        }

        return this.toWorkspace(row);
    }


    public findAll(): Workspace[] {

        const statement = this.database.prepare(`
            SELECT *
            FROM workspaces
            ORDER BY updated_at DESC
        `);

        const rows = statement.all() as any[];

        return rows.map(row => this.toWorkspace(row));
    }


    public update(entity: Workspace): boolean {

        const statement = this.database.prepare(`
            UPDATE workspaces
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


    public deleteById(id: number): boolean {

        const statement = this.database.prepare(`
            DELETE
            FROM workspaces
            WHERE id = ?
        `);

        const result = statement.run(id);

        return result.changes > 0;
    }


    public existsById(id: number): boolean {

        const statement = this.database.prepare(`
            SELECT 1
            FROM workspaces
            WHERE id = ?
            LIMIT 1
        `);

        return statement.get(id) !== undefined;
    }


    private toWorkspace(row: any): Workspace {

        return new Workspace(
            row.id,
            row.name,
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}