import { ipcMain } from 'electron';
import { DatabaseManager } from '../database/DatabaseManager';

// 返回给渲染进程的纯数据结构，避免跨 IPC 传递带方法的实体实例。
type WorkspaceRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  pinned_count: number;
};

type NoteRow = {
  id: number;
  name: string | null;
  transcript: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
};

const database = DatabaseManager.getInstance().getDatabase();

function normalizeName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('工作空间名称不能为空');
  }

  // 限制名称长度，防止界面被异常长文本破坏。
  return name.trim().slice(0, 80);
}

ipcMain.handle('Workspace:getList', () => {
  return (
    database
      // 聚合笔记数量供工作空间卡片展示，避免渲染进程逐个查询造成额外 IPC 往返。
      .prepare(
        `
      SELECT workspaces.id, workspaces.name, workspaces.created_at, workspaces.updated_at,
        COUNT(notes.id) AS note_count,
        COALESCE(SUM(notes.is_pinned), 0) AS pinned_count
      FROM workspaces
      LEFT JOIN notes ON notes.workspace_id = workspaces.id
      GROUP BY workspaces.id
      ORDER BY workspaces.updated_at DESC
    `,
      )
      .all() as WorkspaceRow[]
  );
});

ipcMain.handle('Workspace:create', (_event, rawName: unknown) => {
  const name = normalizeName(rawName);
  const now = new Date().toISOString();
  const result = database
    .prepare(
      'INSERT INTO workspaces (name, created_at, updated_at) VALUES (?, ?, ?)',
    )
    .run(name, now, now);

  return database
    .prepare(
      `SELECT id, name, created_at, updated_at,
      0 AS note_count, 0 AS pinned_count FROM workspaces WHERE id = ?`,
    )
    .get(result.lastInsertRowid) as WorkspaceRow;
});

ipcMain.handle('Workspace:getNotes', (_event, rawWorkspaceId: unknown) => {
  const workspaceId = Number(rawWorkspaceId);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new Error('无效的工作空间 ID');
  }

  // 置顶笔记优先，其余笔记按最近更新时间排列，直接支撑工作空间详情布局。
  return database
    .prepare(
      `SELECT id, name, transcript, is_pinned, created_at, updated_at
      FROM notes WHERE workspace_id = ?
      ORDER BY is_pinned DESC, pinned_at DESC, updated_at DESC`,
    )
    .all(workspaceId) as NoteRow[];
});

ipcMain.handle(
  'Workspace:rename',
  (_event, rawId: unknown, rawName: unknown) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('无效的工作空间 ID');

    const name = normalizeName(rawName);
    const result = database
      .prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, new Date().toISOString(), id);

    return result.changes > 0;
  },
);

ipcMain.handle('Workspace:delete', (_event, rawId: unknown) => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('无效的工作空间 ID');

  // 数据库外键设置了 ON DELETE CASCADE，删除工作空间时其笔记也会随之删除。
  return (
    database.prepare('DELETE FROM workspaces WHERE id = ?').run(id).changes > 0
  );
});
