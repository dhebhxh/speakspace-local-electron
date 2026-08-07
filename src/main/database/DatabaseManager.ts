import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";


export class DatabaseManager {

    private static instance: DatabaseManager | null = null;

    private databasePath: string;
    private database: Database.Database;


    private constructor() {

        const userDataPath = app.getPath("userData");

        this.databasePath = path.join(
            userDataPath,
            "speakspace.db"
        );


        this.database = new Database(
            this.databasePath
        );


        this.initialize();
    }


    private initialize(): void {

        this.database.pragma(
            "foreign_keys = ON"
        );

        this.createCoreTables();

        this.createDefaultWorkspace();
    }


    public static getInstance(): DatabaseManager {

        if (DatabaseManager.instance === null) {

            DatabaseManager.instance =
                new DatabaseManager();
        }

        return DatabaseManager.instance;
    }


    public getDatabase(): Database.Database {

        return this.database;
    }


    public getDatabasePath(): string {

        return this.databasePath;
    }


    public close(): void {

        this.database.close();
    }


    private createCoreTables(): void {

        this.database.exec(`

            CREATE TABLE IF NOT EXISTS workspaces (

                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,

                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );


            CREATE TABLE IF NOT EXISTS notes (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                workspace_id INTEGER NOT NULL,

                name TEXT,

                audio_relative_path TEXT,

                transcript TEXT NOT NULL,

                is_pinned INTEGER NOT NULL DEFAULT 0,

                pinned_at TEXT,

                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,

                FOREIGN KEY(workspace_id)
                    REFERENCES workspaces(id)
                    ON DELETE CASCADE
            );


            CREATE TABLE IF NOT EXISTS subnotes (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                note_id INTEGER NOT NULL,

                content_type TEXT NOT NULL,

                content TEXT NOT NULL,

                created_at TEXT NOT NULL,


                FOREIGN KEY(note_id)
                    REFERENCES notes(id)
                    ON DELETE CASCADE
            );


            CREATE TABLE IF NOT EXISTS knowledge_templates (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                prompt TEXT NOT NULL,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            );


            CREATE TABLE IF NOT EXISTS knowledge_outputs (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                note_id INTEGER NOT NULL,

                template_id INTEGER NOT NULL,

                content_type TEXT NOT NULL,

                content TEXT NOT NULL,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL,


                FOREIGN KEY(note_id)
                    REFERENCES notes(id)
                    ON DELETE CASCADE,


                FOREIGN KEY(template_id)
                    REFERENCES knowledge_templates(id)
                    ON DELETE CASCADE
            );


            CREATE TABLE IF NOT EXISTS ai_conversations (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            );


            CREATE TABLE IF NOT EXISTS ai_messages (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                conversation_id INTEGER NOT NULL,

                role TEXT NOT NULL,

                content TEXT NOT NULL,

                created_at TEXT NOT NULL,


                FOREIGN KEY(conversation_id)
                    REFERENCES ai_conversations(id)
                    ON DELETE CASCADE
            );


            CREATE TABLE IF NOT EXISTS conversation_contexts (

                conversation_id INTEGER NOT NULL,

                note_id INTEGER NOT NULL,


                PRIMARY KEY(
                    conversation_id,
                    note_id
                ),


                FOREIGN KEY(conversation_id)
                    REFERENCES ai_conversations(id)
                    ON DELETE CASCADE,


                FOREIGN KEY(note_id)
                    REFERENCES notes(id)
                    ON DELETE CASCADE
            );

        `);
    }

    private createDefaultWorkspace(): void {
        const statement = this.database.prepare(`
            SELECT COUNT(*) as count
            FROM workspaces
        `);

        const result = statement.get() as {
            count: number
        };

        if (result.count === 0) {
            const now = new Date().toISOString();

            const insert = this.database.prepare(`
                INSERT INTO workspaces (
                    name,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?)
            `);

            insert.run(
                "Default Workspace",
                now,
                now
            );
        }
    }
}
