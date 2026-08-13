import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import WorkspaceDetailHeader from './components/WorkspaceDetailHeader';
import WorkspaceNoteCard from './components/WorkspaceNoteCard';
import WorkspaceSemanticSearch from './components/WorkspaceSemanticSearch';
import WorkspaceMultiNoteModal from './components/WorkspaceMultiNoteModal';
import useWorkspaceDetail from './useWorkspaceDetail';
import './WorkspacePage.css';

/**
 * Workspace 详情页：进入时记录 last_opened_at，并展示该空间的完整内容。
 * updated_at 只用于说明内容或名称最后修改时间。
 */
export default function WorkspacePage() {
  const { t } = useTranslation();
  const detail = useWorkspaceDetail();
  const {
    workspace,
    loading,
    error,
    status,
    query,
    visibleNotes,
    selectedNoteIds,
    toggleNoteSelection,
  } = detail;
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  if (loading) {
    return (
      <p className="workspace-detail-status">{t('workspace.detail.loading')}</p>
    );
  }

  if (!workspace) {
    return (
      <section className="workspace-detail-page">
        <p className="workspace-detail-error" role="alert">
          {error || t('workspace.error.missing')}
        </p>
        <Link className="workspace-back-link" to="/">
          ← {t('workspace.detail.back')}
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
        <span>{t('workspace.detail.search.label')}</span>
        <input
          id="workspace-search"
          onChange={(event) => detail.setQuery(event.target.value)}
          placeholder={t('workspace.detail.search.placeholder')}
          type="search"
          value={query}
        />
      </label>

      <WorkspaceSemanticSearch
        onSelect={detail.revealNote}
        query={query}
        workspaceId={detail.workspaceId}
      />

      {visibleNotes.length === 0 && (
        <div className="workspace-detail-empty">
          <strong>
            {query
              ? t('workspace.detail.empty.searchTitle')
              : t('workspace.detail.empty.title')}
          </strong>
          <span>
            {query
              ? t('workspace.detail.empty.searchDescription')
              : t('workspace.detail.empty.description')}
          </span>
        </div>
      )}

      {selectedNoteIds.length > 0 && (
        <div
          className="workspace-floating-bar"
          style={{
            position: 'sticky',
            top: '20px',
            zIndex: 100,
            backgroundColor: 'var(--accent)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginBottom: '20px',
          }}
        >
          <span>
            {t('workspace.detail.selection.count', {
              count: selectedNoteIds.length,
            })}
          </span>
          <button
            type="button"
            className="btn-primary btn-sm"
            style={{
              backgroundColor: '#fff',
              color: 'var(--accent)',
              marginLeft: '16px',
            }}
            onClick={() => setShowAnalysisModal(true)}
            disabled={selectedNoteIds.length < 2}
          >
            {selectedNoteIds.length < 2
              ? t('workspace.detail.selection.minimum')
              : t('workspace.detail.selection.analyze')}
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
