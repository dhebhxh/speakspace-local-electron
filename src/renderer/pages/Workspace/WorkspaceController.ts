export type WorkspaceItem = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  pinned_count: number;
};

export type NoteItem = {
  id: number;
  name: string | null;
  transcript: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
};

type WorkspaceApi = {
  getList(): Promise<WorkspaceItem[]>;
  create(name: string): Promise<WorkspaceItem>;
  getNotes(workspaceId: number): Promise<NoteItem[]>;
  rename(workspaceId: number, name: string): Promise<boolean>;
  delete(workspaceId: number): Promise<boolean>;
};

/**
 * 渲染进程工作空间控制器：封装 IPC 调用和纯展示逻辑。
 * Renderer workspace controller: wraps IPC calls and view-only transformations.
 *
 * 操作方式 / Usage:
 * WorkspacePage 创建一个实例，然后通过公开方法读取或修改工作空间。
 * WorkspacePage owns one instance and uses its public methods for all operations.
 */
export class WorkspaceController {
  private readonly api: WorkspaceApi;

  public constructor(api: WorkspaceApi = window.electron.workspace) {
    this.api = api;
  }

  public getWorkspaces(): Promise<WorkspaceItem[]> {
    return this.api.getList();
  }

  public createWorkspace(name: string): Promise<WorkspaceItem> {
    return this.api.create(name);
  }

  public getWorkspaceNotes(workspaceId: number): Promise<NoteItem[]> {
    return this.api.getNotes(workspaceId);
  }

  public renameWorkspace(workspaceId: number, name: string): Promise<boolean> {
    return this.api.rename(workspaceId, name);
  }

  public deleteWorkspace(workspaceId: number): Promise<boolean> {
    return this.api.delete(workspaceId);
  }

  public static filterNotes(notes: NoteItem[], query: string): NoteItem[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return notes;

    return notes.filter((note) =>
      `${note.name ?? ''} ${note.transcript}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }

  public static formatDate(value: string, format: 'long' | 'short'): string {
    const options: Intl.DateTimeFormatOptions =
      format === 'long'
        ? { dateStyle: 'long' }
        : { month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat('zh-CN', options).format(new Date(value));
  }

  public static getErrorMessage(reason: unknown, fallback: string): string {
    return reason instanceof Error ? reason.message : fallback;
  }
}
