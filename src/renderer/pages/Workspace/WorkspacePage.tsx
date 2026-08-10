import { Link } from 'react-router-dom';
import WorkspaceDetailHeader from './components/WorkspaceDetailHeader';
import WorkspaceNoteCard from './components/WorkspaceNoteCard';
import useWorkspaceDetail from './useWorkspaceDetail';
import './WorkspacePage.css';

/**
 * Workspace 详情页：进入时记录 last_opened_at，并展示该空间的完整内容。
 * updated_at 只用于说明内容或名称最后修改时间。
 */
export default function WorkspacePage() {
  const detail = useWorkspaceDetail();
  const { workspace, loading, error, status, query, visibleNotes } = detail;

  if (loading) {
    return <p className="workspace-detail-status">正在进入工作空间…</p>;
  }

  if (!workspace) {
    return (
      <section className="workspace-detail-page">
        <p className="workspace-detail-error" role="alert">
          {error || '工作空间不存在'}
        </p>
        <Link className="workspace-back-link" to="/">
          ← 返回最近使用
        </Link>
      </section>
    );
  }

  return (
    <section className="workspace-detail-page">
      <WorkspaceDetailHeader
        onDelete={detail.deleteWorkspace}
        onRename={detail.renameWorkspace}
        workspace={workspace}
      />

      {error && (
        <p className="workspace-detail-error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="workspace-detail-success">{status}</p>}

      <label className="workspace-detail-search" htmlFor="workspace-search">
        <span>搜索笔记、转录、子笔记或 AI 内容</span>
        <input
          id="workspace-search"
          onChange={(event) => detail.setQuery(event.target.value)}
          placeholder="输入标题或内容关键词"
          type="search"
          value={query}
        />
      </label>

      {visibleNotes.length === 0 && (
        <div className="workspace-detail-empty">
          <strong>{query ? '没有匹配内容' : '这个工作空间还没有笔记'}</strong>
          <span>{query ? '尝试更换搜索词。' : '完成录音后可归档到这里。'}</span>
        </div>
      )}

      <div className="workspace-detail-notes">
        {visibleNotes.map((note) => (
          <WorkspaceNoteCard
            generating={detail.generatingNoteId === note.id}
            key={note.id}
            note={note}
            onGenerate={detail.generateOutput}
            templates={detail.templates}
            workspaceId={detail.workspaceId}
          />
        ))}
      </div>
    </section>
  );
}
