import { Link } from 'react-router-dom';
import WorkspaceDetailHeader from './components/WorkspaceDetailHeader';
import WorkspaceNoteCard from './components/WorkspaceNoteCard';
import WorkspaceSemanticSearch from './components/WorkspaceSemanticSearch';
import WorkspaceMultiNoteModal from './components/WorkspaceMultiNoteModal';
import useWorkspaceDetail from './useWorkspaceDetail';
import { useState } from 'react';
import './WorkspacePage.css';

/**
 * Workspace 详情页：进入时记录 last_opened_at，并展示该空间的完整内容。
 * updated_at 只用于说明内容或名称最后修改时间。
 */
export default function WorkspacePage() {
  const detail = useWorkspaceDetail();
  const { workspace, loading, error, status, query, visibleNotes, selectedNoteIds, toggleNoteSelection } = detail;
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

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

      {/* 关键词搜索与语义查找合并成一条工具条：
          搜索框只占它需要的宽度，语义查找就在旁边。 */}
      <div className="workspace-toolbar">
        <div className="workspace-search-field">
          <span aria-hidden="true" className="workspace-search-icon">
            🔍
          </span>
          <input
            aria-label="搜索标题、转录、子笔记或 AI 内容"
            id="workspace-search"
            onChange={(event) => detail.setQuery(event.target.value)}
            placeholder="搜索笔记…"
            title="搜索标题、转录、子笔记或 AI 内容"
            type="search"
            value={query}
          />
        </div>

        <WorkspaceSemanticSearch
          onSelect={detail.revealNote}
          query={query}
          workspaceId={detail.workspaceId}
        />
      </div>

      {visibleNotes.length === 0 && (
        <div className="workspace-detail-empty">
          <strong>{query ? '没有找到内容' : '这个工作空间还没有笔记'}</strong>
          <span>{query ? '尝试更换搜索词' : '完成录音即可归档到这里'}</span>
        </div>
      )}

      {selectedNoteIds.length > 0 && (
        <div className="workspace-select-bar">
          <span>已选取 {selectedNoteIds.length} 篇笔记</span>
          <button
            className="ws-btn ws-btn-primary"
            disabled={selectedNoteIds.length < 2}
            onClick={() => setShowAnalysisModal(true)}
            type="button"
          >
            {selectedNoteIds.length < 2 ? '请至少选择 2 篇' : '分析选中笔记'}
          </button>
        </div>
      )}

      <div className="workspace-detail-notes">
        {visibleNotes.map((note) => (
          <WorkspaceNoteCard
            generating={detail.generatingNoteId === note.id}
            key={note.id}
            note={note}
            isSelected={selectedNoteIds.includes(note.id)}
            onToggleSelection={toggleNoteSelection}
            onGenerate={detail.generateOutput}
            templates={detail.templates}
            workspaceId={detail.workspaceId}
          />
        ))}
      </div>

      {showAnalysisModal && (
        <WorkspaceMultiNoteModal 
          selectedNoteIds={selectedNoteIds} 
          workspaceId={detail.workspaceId} 
          onClose={() => setShowAnalysisModal(false)} 
        />
      )}
    </section>
  );
}
