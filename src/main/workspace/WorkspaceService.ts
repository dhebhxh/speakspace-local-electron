import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/DatabaseManager';
import { BlobStorage } from '../database/BlobStorage';

// what you need to know about a workspace(just summary to show)
// data structure of a workspace
export type WorkspaceSummary = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  recent_at: string;
  note_count: number;
  pinned_count: number;
};

export type WorkspaceSubnote = {
  id: number;
  content_type: string;
  content: string;
  created_at: string;
};

export type WorkspaceKnowledgeOutput = {
  id: number;
  template_name: string;
  content_type: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceAiMessage = {
  id: number;
  role: string;
  content: string;
  created_at: string;
};

export type WorkspaceAiConversation = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  messages: WorkspaceAiMessage[];
};

export type WorkspaceNote = {
  id: number;
  name: string | null;
  audio_relative_path: string | null;
  transcript: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  subnotes: WorkspaceSubnote[];
  knowledge_outputs: WorkspaceKnowledgeOutput[];
  conversations: WorkspaceAiConversation[];
};

export type WorkspaceAudioData = {
  mime_type: string;
  bytes: Uint8Array;
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
  public listWorkspaces(rawLimit: unknown = 6): WorkspaceSummary[] {
    const limit = WorkspaceService.normalizeLimit(rawLimit);

    // 首页按最近进入时间排序；updated_at 只描述内容或名称的修改时间。
    // Home ordering follows access time, never content modification time.
    const statement = this.database.prepare(`
      SELECT workspaces.id, workspaces.name,
        workspaces.created_at, workspaces.updated_at,
        workspaces.last_opened_at,
        COALESCE(workspaces.last_opened_at, workspaces.created_at) AS recent_at,
        COUNT(notes.id) AS note_count,
        COALESCE(SUM(notes.is_pinned), 0) AS pinned_count
      FROM workspaces
      LEFT JOIN notes ON notes.workspace_id = workspaces.id
      GROUP BY workspaces.id
      ORDER BY COALESCE(workspaces.last_opened_at, workspaces.created_at) DESC,
        workspaces.id DESC
      LIMIT ?
    `);

    const workspaces = statement.all(limit) as WorkspaceSummary[];

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

    return this.getWorkspaceSummary(insertResult.lastInsertRowid);
  }

  /**
   * 进入详情时记录最近打开时间；不修改 updated_at。
   * Opening a Workspace changes access order without claiming its content changed.
   */
  public openWorkspace(rawId: unknown): WorkspaceSummary {
    const id = WorkspaceService.normalizeId(rawId);
    const statement = this.database.prepare(
      'UPDATE workspaces SET last_opened_at = ? WHERE id = ?',
    );
    const result = statement.run(new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new Error('工作空间不存在 / Workspace not found');
    }

    return this.getWorkspaceSummary(id);
  }

  // 获取指定工作空间中的笔记
  // Get notes in a specific workspace
  public listNotes(rawWorkspaceId: unknown): WorkspaceNote[] {
    const workspaceId = WorkspaceService.normalizeId(rawWorkspaceId);

    // 先显示置顶笔记，再显示最近更新的普通笔记
    // Pinned notes appear first, followed by recently updated notes.
    const noteStatement = this.database.prepare(
      `SELECT id, name, audio_relative_path, transcript, is_pinned,
        created_at, updated_at
      FROM notes WHERE workspace_id = ?
      ORDER BY is_pinned DESC, pinned_at DESC, updated_at DESC`,
    );
    const noteRows = noteStatement.all(workspaceId) as Array<
      Omit<WorkspaceNote, 'subnotes' | 'knowledge_outputs' | 'conversations'>
    >;

    const subnoteStatement = this.database.prepare(
      `SELECT id, content_type, content, created_at
      FROM subnotes WHERE note_id = ? ORDER BY created_at ASC`,
    );
    const outputStatement = this.database.prepare(
      `SELECT knowledge_outputs.id, knowledge_templates.name AS template_name,
        knowledge_outputs.content_type, knowledge_outputs.content,
        knowledge_outputs.created_at, knowledge_outputs.updated_at
      FROM knowledge_outputs
      JOIN knowledge_templates
        ON knowledge_templates.id = knowledge_outputs.template_id
      WHERE knowledge_outputs.note_id = ?
      ORDER BY knowledge_outputs.updated_at DESC`,
    );
    const conversationStatement = this.database.prepare(
      `SELECT ai_conversations.id, ai_conversations.name,
        ai_conversations.created_at, ai_conversations.updated_at
      FROM conversation_contexts
      JOIN ai_conversations
        ON ai_conversations.id = conversation_contexts.conversation_id
      WHERE conversation_contexts.note_id = ?
      ORDER BY ai_conversations.updated_at DESC`,
    );
    const messageStatement = this.database.prepare(
      `SELECT id, role, content, created_at
      FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    );

    const notes: WorkspaceNote[] = [];
    // 普通循环让多阶段查询与组装过程保持可读。
    // eslint-disable-next-line no-restricted-syntax
    for (const note of noteRows) {
      const subnotes = subnoteStatement.all(note.id) as WorkspaceSubnote[];
      const knowledgeOutputs = outputStatement.all(
        note.id,
      ) as WorkspaceKnowledgeOutput[];
      const conversationRows = conversationStatement.all(note.id) as Array<
        Omit<WorkspaceAiConversation, 'messages'>
      >;
      const conversations: WorkspaceAiConversation[] = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const conversation of conversationRows) {
        const messages = messageStatement.all(
          conversation.id,
        ) as WorkspaceAiMessage[];
        conversations.push({ ...conversation, messages });
      }

      notes.push({
        ...note,
        subnotes,
        knowledge_outputs: knowledgeOutputs,
        conversations,
      });
    }

    return notes;
  }

  public async getNoteAudio(
    rawWorkspaceId: unknown,
    rawNoteId: unknown,
  ): Promise<WorkspaceAudioData | null> {
    const workspaceId = WorkspaceService.normalizeId(rawWorkspaceId);
    const noteId = WorkspaceService.normalizeId(rawNoteId);
    const statement = this.database.prepare(
      `SELECT audio_relative_path FROM notes
      WHERE id = ? AND workspace_id = ?`,
    );
    const row = statement.get(noteId, workspaceId) as
      | { audio_relative_path: string | null }
      | undefined;

    if (!row?.audio_relative_path) return null;

    const storage = BlobStorage.getInstance();
    if (!storage.exists(row.audio_relative_path)) return null;

    const audio = storage.load(row.audio_relative_path);
    const buffer = await audio.arrayBuffer();
    return {
      mime_type: WorkspaceService.getAudioMimeType(row.audio_relative_path),
      bytes: new Uint8Array(buffer),
    };
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

  private static normalizeLimit(value: unknown): number {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error(
        '工作空间数量必须为 1 到 100 / Workspace limit must be 1-100',
      );
    }
    return limit;
  }

  private getWorkspaceSummary(id: number | bigint): WorkspaceSummary {
    const statement = this.database.prepare(
      `SELECT workspaces.id, workspaces.name,
        workspaces.created_at, workspaces.updated_at,
        workspaces.last_opened_at,
        COALESCE(workspaces.last_opened_at, workspaces.created_at) AS recent_at,
        COUNT(notes.id) AS note_count,
        COALESCE(SUM(notes.is_pinned), 0) AS pinned_count
      FROM workspaces
      LEFT JOIN notes ON notes.workspace_id = workspaces.id
      WHERE workspaces.id = ?
      GROUP BY workspaces.id`,
    );
    const workspace = statement.get(id) as WorkspaceSummary | undefined;

    if (!workspace) {
      throw new Error('工作空间不存在 / Workspace not found');
    }
    return workspace;
  }

  private static getAudioMimeType(relativePath: string): string {
    const extension = relativePath.toLocaleLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      mp4: 'audio/mp4',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
    };
    return mimeTypes[extension ?? ''] ?? 'application/octet-stream';
  }
}
