import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/DatabaseManager';

// what you need to know about a workspace(just summary to show)
// data structure of a workspace
export type WorkspaceSummary = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  pinned_count: number;
};

// note inside workspace
// data structure of a note inside workspace
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
 */
export class WorkspaceService {
  // still read-only to avoid reassigning database causeing unexpected problems.
  private readonly database: Database.Database;

  // initialize
  public constructor(database = DatabaseManager.getInstance().getDatabase()) {
    this.database = database;
  }

  // 获取工作空间列表及其笔记统计
  // Get a list of workspaces with note statistics
  public listWorkspaces(): WorkspaceSummary[] {
    // use LEFT JOIN to know workspace and all notes in once query
    // 第一步：准备 SQL 查询，但此时还没有访问数据库。
    const statement = this.database.prepare(`
      SELECT workspaces.id, workspaces.name,
        workspaces.created_at, workspaces.updated_at,
        COUNT(notes.id) AS note_count,
        COALESCE(SUM(notes.is_pinned), 0) AS pinned_count
      FROM workspaces
      LEFT JOIN notes ON notes.workspace_id = workspaces.id
      GROUP BY workspaces.id
      ORDER BY workspaces.updated_at DESC
    `);

    // 第二步：all() 执行查询并取得全部结果；查询单条记录时使用 get()。
    const workspaces = statement.all() as WorkspaceSummary[];

    // 第三步：把查询结果返回给调用者。
    return workspaces;
  }

  // 创建一个新的工作空间
  // Create a new workspace
  public createWorkspace(rawName: unknown): WorkspaceSummary {
    const name = WorkspaceService.normalizeName(rawName);
    const now = new Date().toISOString();

    // 先准备并执行新增语句，run() 用于 INSERT、UPDATE 和 DELETE。
    const insertStatement = this.database.prepare(
      'INSERT INTO workspaces (name, created_at, updated_at) VALUES (?, ?, ?)',
    );
    const insertResult = insertStatement.run(name, now, now);

    // 再用新增记录的 ID 查询完整数据并返回。
    const selectStatement = this.database.prepare(
      `SELECT id, name, created_at, updated_at,
        0 AS note_count, 0 AS pinned_count
      FROM workspaces WHERE id = ?`,
    );
    const workspace = selectStatement.get(
      insertResult.lastInsertRowid,
    ) as WorkspaceSummary;

    return workspace;
  }

  // 获取指定工作空间中的笔记
  // Get notes in a specific workspace
  public listNotes(rawWorkspaceId: unknown): WorkspaceNote[] {
    const workspaceId = WorkspaceService.normalizeId(rawWorkspaceId);

    // 先显示置顶笔记，再显示最近更新的普通笔记
    // Pinned notes appear first, followed by recently updated notes.
    const statement = this.database.prepare(
      `SELECT id, name, transcript, is_pinned, created_at, updated_at
      FROM notes WHERE workspace_id = ?
      ORDER BY is_pinned DESC, pinned_at DESC, updated_at DESC`,
    );
    const notes = statement.all(workspaceId) as WorkspaceNote[];

    return notes;
  }

  // 修改工作空间名称
  // Rename a workspace
  public renameWorkspace(rawId: unknown, rawName: unknown): boolean {
    const id = WorkspaceService.normalizeId(rawId);
    const name = WorkspaceService.normalizeName(rawName);
    const statement = this.database.prepare(
      'UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?',
    );
    const result = statement.run(name, new Date().toISOString(), id);

    return result.changes > 0;
  }

  // 删除工作空间及其所属笔记
  // Delete a workspace and its notes
  public deleteWorkspace(rawId: unknown): boolean {
    const id = WorkspaceService.normalizeId(rawId);
    // notes 表使用 ON DELETE CASCADE，删除工作空间会同步删除所属笔记。
    // ON DELETE CASCADE removes all notes that belong to the workspace.
    const statement = this.database.prepare(
      'DELETE FROM workspaces WHERE id = ?',
    );
    const result = statement.run(id);

    return result.changes > 0;
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
