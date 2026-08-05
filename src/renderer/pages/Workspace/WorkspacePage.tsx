import { FormEvent, useCallback, useEffect, useState } from 'react';
import './WorkspacePage.css';

type WorkspaceItem = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  pinned_count: number;
};

type NoteItem = {
  id: number;
  name: string | null;
  transcript: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
};

export default function WorkspacePage() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [query, setQuery] = useState('');

  // 操作方法：进入页面会自动读取列表；数据发生变化后重新读取，以数据库结果为准。
  const loadWorkspaces = useCallback(async () => {
    try {
      setError('');
      const result = await window.electron.workspace.getList();
      setItems(result);
      // 首次进入时自动选中最近使用的工作空间；刷新列表时保留用户当前选择。
      setSelectedId((current) => current ?? result[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取工作空间失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (selectedId === null) {
      setNotes([]);
      return;
    }

    const loadNotes = async () => {
      setNotesLoading(true);
      try {
        setError('');
        setNotes(await window.electron.workspace.getNotes(selectedId));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '读取笔记失败');
      } finally {
        setNotesLoading(false);
      }
    };
    loadNotes();
  }, [selectedId]);

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setError('');
      const created = await window.electron.workspace.create(name);
      setName('');
      setSelectedId(created.id);
      await loadWorkspaces();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建工作空间失败');
    }
  };

  const renameWorkspace = async (item: WorkspaceItem) => {
    // 桌面端轻量重命名使用系统输入框，取消时不会修改数据。
    // eslint-disable-next-line no-alert
    const nextName = window.prompt('输入新的工作空间名称', item.name);
    if (nextName === null || !nextName.trim() || nextName.trim() === item.name)
      return;
    try {
      await window.electron.workspace.rename(item.id, nextName);
      await loadWorkspaces();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重命名失败');
    }
  };

  const deleteWorkspace = async (item: WorkspaceItem) => {
    // 删除会级联清除其笔记，因此执行前明确向用户确认。
    // eslint-disable-next-line no-alert
    if (!window.confirm(`确定删除“${item.name}”及其中的全部笔记吗？`)) return;
    try {
      await window.electron.workspace.delete(item.id);
      if (selectedId === item.id) setSelectedId(null);
      await loadWorkspaces();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败');
    }
  };

  const selectedWorkspace =
    items.find((item) => item.id === selectedId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleNotes = notes.filter((note) => {
    if (!normalizedQuery) return true;
    return `${note.name ?? ''} ${note.transcript}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section className="workspace-page">
      <header className="workspace-header">
        <div>
          <span className="workspace-eyebrow">KNOWLEDGE HUB</span>
          <h1>工作空间</h1>
          <p>按主题整理录音、转录文本和 AI 生成的知识内容。</p>
        </div>
        <form className="workspace-create" onSubmit={createWorkspace}>
          <span className="workspace-create-label">新工作空间名称</span>
          <div>
            <input
              id="workspace-name"
              aria-label="新工作空间名称"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：项目会议"
              value={name}
            />
            <button type="submit" disabled={!name.trim()}>
              创建
            </button>
          </div>
        </form>
      </header>

      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="workspace-status">正在读取工作空间…</p>}
      {!loading && items.length === 0 && (
        <div className="workspace-empty">
          <span aria-hidden="true">◇</span>
          <h2>建立第一个工作空间</h2>
          <p>在上方输入名称，即可开始归档录音与笔记。</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="workspace-shell">
          <aside className="workspace-list" aria-label="工作空间列表">
            {items.map((item) => (
              <button
                className={`workspace-card${selectedId === item.id ? ' is-selected' : ''}`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <span className="workspace-card-icon" aria-hidden="true">
                  W
                </span>
                <span className="workspace-card-copy">
                  <strong>{item.name}</strong>
                  <small>
                    {item.note_count} 篇笔记 · {item.pinned_count} 篇置顶
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </aside>

          {selectedWorkspace && (
            <section
              className="workspace-detail"
              aria-label={`${selectedWorkspace.name}详情`}
            >
              <div className="workspace-detail-header">
                <div>
                  <span className="workspace-eyebrow">CURRENT WORKSPACE</span>
                  <h2>{selectedWorkspace.name}</h2>
                  <p>
                    最近更新{' '}
                    {new Intl.DateTimeFormat('zh-CN', {
                      dateStyle: 'long',
                    }).format(new Date(selectedWorkspace.updated_at))}
                  </p>
                </div>
                <div className="workspace-card-actions">
                  <button
                    type="button"
                    className="workspace-secondary"
                    onClick={() => renameWorkspace(selectedWorkspace)}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="workspace-danger"
                    onClick={() => deleteWorkspace(selectedWorkspace)}
                  >
                    删除
                  </button>
                </div>
              </div>

              <label
                className="workspace-search"
                htmlFor="workspace-note-search"
              >
                <span>搜索当前工作空间</span>
                <input
                  id="workspace-note-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="按标题或转录内容搜索"
                  type="search"
                  value={query}
                />
              </label>

              {notesLoading && (
                <p className="workspace-note-message">正在读取笔记…</p>
              )}
              {!notesLoading && visibleNotes.length === 0 && (
                <div className="workspace-note-message">
                  <strong>
                    {query ? '没有匹配的笔记' : '这个工作空间还没有笔记'}
                  </strong>
                  <span>
                    {query
                      ? '尝试更换搜索词。'
                      : '完成一次录音后，可将转录内容归档到这里。'}
                  </span>
                </div>
              )}
              <div className="workspace-note-list">
                {visibleNotes.map((note) => (
                  <article className="workspace-note" key={note.id}>
                    <div>
                      <span className="workspace-note-kind">
                        {note.is_pinned ? '置顶笔记' : '转录笔记'}
                      </span>
                      <h3>{note.name || '未命名笔记'}</h3>
                      <p>{note.transcript || '暂无转录内容'}</p>
                    </div>
                    <time dateTime={note.updated_at}>
                      {new Intl.DateTimeFormat('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(note.updated_at))}
                    </time>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
