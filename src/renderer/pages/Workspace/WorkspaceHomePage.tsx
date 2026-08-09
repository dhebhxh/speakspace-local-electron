import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WorkspaceController, WorkspaceItem } from './WorkspaceController';
import './WorkspaceHomePage.css';

const workspaceController = new WorkspaceController();

type WorkspaceHomePageProps = {
  limit: number;
  directory: boolean;
};

/**
 * 首页只展示最近使用的 Workspace 摘要；完整内容留在独立详情页。
 * The home page remains a lightweight recent-entry surface.
 */
export default function WorkspaceHomePage({
  limit,
  directory,
}: WorkspaceHomePageProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadWorkspaces = useCallback(async () => {
    try {
      setError('');
      setItems(await workspaceController.getWorkspaces(limit));
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '读取工作空间失败'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      setError('');
      const created = await workspaceController.createWorkspace(name);
      navigate(`/Workspace/${created.id}`);
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '创建工作空间失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="workspace-home">
      <header className="workspace-home-header">
        <div>
          <span className="workspace-home-eyebrow">
            {directory ? 'ALL WORKSPACES' : 'RECENT WORKSPACES'}
          </span>
          <h1>{directory ? '全部工作空间' : '最近使用'}</h1>
          <p>
            {directory
              ? '选择一个工作空间进入完整内容。'
              : '从最近进入的工作空间继续，首页仅保留必要摘要。'}
          </p>
        </div>

        <form className="workspace-home-create" onSubmit={createWorkspace}>
          <label htmlFor="recent-workspace-name">
            <span>新工作空间名称</span>
            <div>
              <input
                id="recent-workspace-name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：项目会议"
                value={name}
              />
              <button disabled={!name.trim() || creating} type="submit">
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </label>
        </form>
      </header>

      {error && (
        <p className="workspace-home-error" role="alert">
          {error}
        </p>
      )}

      <div className="workspace-home-section-heading">
        <div>
          <h2>{directory ? '工作空间目录' : '继续最近工作'}</h2>
          <p>按最近打开时间排列；从未打开的项目按创建时间排列。</p>
        </div>
        {!directory && <Link to="/Workspace">查看全部工作空间</Link>}
      </div>

      {loading && <p className="workspace-home-status">正在读取工作空间…</p>}

      {!loading && items.length === 0 && (
        <div className="workspace-home-empty">
          <span aria-hidden="true">◇</span>
          <h2>建立第一个工作空间</h2>
          <p>输入名称后进入详情，即可归档录音、转录和 AI 内容。</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="workspace-home-grid">
          {items.map((item, index) => (
            <button
              className="workspace-home-card"
              key={item.id}
              onClick={() => navigate(`/Workspace/${item.id}`)}
              type="button"
            >
              <span className="workspace-home-card-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="workspace-home-card-icon" aria-hidden="true">
                W
              </span>
              <span className="workspace-home-card-copy">
                <strong>{item.name}</strong>
                <small>
                  {item.note_count} 篇笔记 · {item.pinned_count} 篇置顶
                </small>
                <time dateTime={item.recent_at}>
                  {item.last_opened_at ? '最近打开' : '创建于'}{' '}
                  {WorkspaceController.formatDate(item.recent_at, 'long')}
                </time>
              </span>
              <span className="workspace-home-card-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
