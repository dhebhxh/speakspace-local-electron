import { DatabaseManager } from "../DatabaseManager";

export interface TodoData {
    id?: number;
    noteId: number;
    title: string;
    dateString: string;
    isCompleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export class TodoRepository {
    private dbManager: DatabaseManager;

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    public createTodo(todo: TodoData): TodoData {
        const db = this.dbManager.getDatabase();
        const now = new Date().toISOString();
        
        const stmt = db.prepare(`
            INSERT INTO todos (note_id, title, date_string, is_completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            todo.noteId,
            todo.title,
            todo.dateString,
            todo.isCompleted ? 1 : 0,
            now,
            now
        );
        
        return {
            ...todo,
            id: info.lastInsertRowid as number,
            createdAt: new Date(now),
            updatedAt: new Date(now)
        };
    }

    public getTodosByNoteId(noteId: number): TodoData[] {
        const db = this.dbManager.getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM todos WHERE note_id = ? ORDER BY created_at ASC
        `);
        
        const rows = stmt.all(noteId) as any[];
        return rows.map(row => this.mapRowToTodoData(row));
    }

    public getAllTodos(): TodoData[] {
        const db = this.dbManager.getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM todos ORDER BY created_at DESC
        `);
        
        const rows = stmt.all() as any[];
        return rows.map(row => this.mapRowToTodoData(row));
    }

    public updateTodoStatus(id: number, isCompleted: boolean): void {
        const db = this.dbManager.getDatabase();
        const now = new Date().toISOString();
        
        const stmt = db.prepare(`
            UPDATE todos SET is_completed = ?, updated_at = ? WHERE id = ?
        `);
        
        stmt.run(isCompleted ? 1 : 0, now, id);
    }
    
    public deleteTodosByNoteId(noteId: number): void {
        const db = this.dbManager.getDatabase();
        const stmt = db.prepare(`
            DELETE FROM todos WHERE note_id = ?
        `);
        stmt.run(noteId);
    }

    private mapRowToTodoData(row: any): TodoData {
        return {
            id: row.id,
            noteId: row.note_id,
            title: row.title,
            dateString: row.date_string,
            isCompleted: row.is_completed === 1,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
