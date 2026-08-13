import Database from "better-sqlite3";
import { DatabaseManager } from "../database/DatabaseManager";

export interface DashboardNoteDTO {
    id: number;
    workspaceId: number | null;
    name: string | null;
    audioRelativePath: string | null;
    transcript: string;
    isPinned: boolean;
    pinnedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    typeCategory: string;
    durationSeconds: number;
}

export interface DashboardOverviewDTO {
    notes: DashboardNoteDTO[];
}

export class DashboardService {
    private database: Database.Database;

    public constructor() {
        const dbManager = DatabaseManager.getInstance();
        this.database = dbManager.getDatabase();
    }

    public getDashboardOverview(): DashboardOverviewDTO {
        const statement = this.database.prepare(`
            SELECT *
            FROM notes
            ORDER BY updated_at DESC
            LIMIT 50
        `);

        const rows = statement.all() as any[];

        const notes: DashboardNoteDTO[] = rows.map(row => ({
            id: row.id,
            workspaceId: row.workspace_id,
            name: row.name,
            audioRelativePath: row.audio_relative_path,
            transcript: row.transcript,
            isPinned: row.is_pinned === 1,
            pinnedAt: row.pinned_at === null ? null : new Date(row.pinned_at),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            typeCategory: "未分類",
            durationSeconds: 0
        }));

        return {
            notes
        };
    }
}
