import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/DatabaseManager';

export type WorkspaceSummary = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  pinned_count: number;
};

export type WorkspaceNote = {
  id: number;
  name: string | null;
  transcript: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
};

/**
 * 工作空间业务服务：集中处理验证与数据库操作。
 * Workspace service: encapsulates validation and database operations.
 *
 * 操作方式 / Usage:
 * 由主进程的 WorkspaceIpcController 创建并调用，不应在 renderer 中直接实例化。
 * Instantiate it from WorkspaceIpcController in the main process, never directly in renderer.
 */
export class WorkspaceService {
  private readonly database: Database.Database;

  public constructor(database = DatabaseManager.getInstance().getDatabase()) {
    this.database = database;
  }

  public listWorkspaces(): WorkspaceSummary[] {
    // 一次查询聚合笔记统计，减少 main 与 renderer 之间的 IPC 往返。
    // Aggregate note statistics in one query to reduce IPC round trips.
    return this.database
      .prepare(
        `
          SELECT workspaces.id, workspaces.name,
            workspaces.created_at, workspaces.updated_at,
            COUNT(notes.id) AS note_count,
            COALESCE(SUM(notes.is_pinned), 0) AS pinned_count
          FROM workspaces
          LEFT JOIN notes ON notes.workspace_id = workspaces.id
          GROUP BY workspaces.id
          ORDER BY workspaces.updated_at DESC
        `,
      )
      .all() as WorkspaceSummary[];
  }

  public createWorkspace(rawName: unknown): WorkspaceSummary {
    const name = WorkspaceService.normalizeName(rawName);
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        'INSERT INTO workspaces (name, created_at, updated_at) VALUES (?, ?, ?)',
      )
      .run(name, now, now);

    return this.database
      .prepare(
        `SELECT id, name, created_at, updated_at,
          0 AS note_count, 0 AS pinned_count
        FROM workspaces WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as WorkspaceSummary;
  }

  public listNotes(rawWorkspaceId: unknown): WorkspaceNote[] {
    const workspaceId = WorkspaceService.normalizeId(rawWorkspaceId);

    // 先显示置顶笔记，再显示最近更新的普通笔记。
    // Pinned notes appear first, followed by recently updated notes.
    return this.database
      .prepare(
        `SELECT id, name, transcript, is_pinned, created_at, updated_at
        FROM notes WHERE workspace_id = ?
        ORDER BY is_pinned DESC, pinned_at DESC, updated_at DESC`,
      )
      .all(workspaceId) as WorkspaceNote[];
  }

  public renameWorkspace(rawId: unknown, rawName: unknown): boolean {
    const id = WorkspaceService.normalizeId(rawId);
    const name = WorkspaceService.normalizeName(rawName);
    const result = this.database
      .prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, new Date().toISOString(), id);

    return result.changes > 0;
  }

  public deleteWorkspace(rawId: unknown): boolean {
    const id = WorkspaceService.normalizeId(rawId);
    // notes 表使用 ON DELETE CASCADE，删除工作空间会同步删除所属笔记。
    // ON DELETE CASCADE removes all notes that belong to the workspace.
    return (
      this.database.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
        .changes > 0
    );
  }

  private static normalizeName(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('工作空间名称不能为空 / Workspace name is required');
    }

    return value.trim().slice(0, 80);
  }

  private static normalizeId(value: unknown): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('无效的工作空间 ID / Invalid workspace ID');
    }
    return id;
  }
}
