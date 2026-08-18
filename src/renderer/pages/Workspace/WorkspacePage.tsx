import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
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
    setQuery,
    visibleNotes,
    selectedNoteIds,
    toggleNoteSelection,
  } = detail;
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    noteId: number;
  } | null>(null);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleContextMenu = (noteId: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, noteId });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDeleteNote = async (noteId: number) => {
    await detail.deleteNote(noteId);
    closeContextMenu();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  if (loading) {
    return (
      <p className="workspace-detail-status">{t('workspace.detail.loading')}</p>
    );
  }

  if (!workspace) {
    return (
      <section className="workspace-detail-page">
        <p className="workspace-detail-error" role="alert">
          {error || t('workspace.error.notFound')}
        </p>
        <Link className="workspace-back-link" to="/">
          {t('workspace.detail.back')}
        </Link>
      </section>
    );
  }

  return (
    <section className="workspace-detail-page">
      <WorkspaceDetailHeader
        onDelete={() => setShowDeleteModal(true)}
        onRename={() => {
          setRenameInput(workspace.name);
          setShowRenameModal(true);
        }}
        workspace={workspace}
      />

      {error && (
        <p className="workspace-detail-error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="workspace-detail-success">{status}</p>}

      <div className="workspace-toolbar">
        <div className="workspace-search-field">
          <Search className="workspace-search-icon" size={18} />
          <input
            aria-label={t('workspace.detail.search')}
            id="workspace-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('workspace.detail.searchPlaceholder')}
            title={t('workspace.detail.search')}
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
          <strong>
            {query
              ? t('workspace.detail.emptySearch')
              : t('workspace.detail.empty')}
          </strong>
          <span>
            {query
              ? t('workspace.detail.emptySearchDesc')
              : t('workspace.detail.emptyDesc')}
          </span>
        </div>
      )}

      {selectedNoteIds.length > 0 && (
        <div className="workspace-select-bar">
          <span>
            {t('workspace.detail.selected')} {selectedNoteIds.length}{' '}
            {t('workspace.detail.notesSuffix')}
          </span>
          <button
            className="ws-btn ws-btn-primary"
            disabled={selectedNoteIds.length < 2}
            onClick={() => setShowMultiModal(true)}
            type="button"
          >
            {selectedNoteIds.length < 2
              ? t('workspace.detail.selectMore')
              : t('workspace.detail.actionOnSelected')}
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
            onContextMenu={handleContextMenu}
            onGenerate={detail.generateOutput}
            templates={detail.templates}
            workspaceId={detail.workspaceId}
          />
        ))}
      </div>

      {showMultiModal && (
        <WorkspaceMultiNoteModal
          selectedNoteIds={selectedNoteIds}
          workspaceId={detail.workspaceId}
          onClose={() => setShowMultiModal(false)}
        />
      )}

      {contextMenu && (
        <button
          type="button"
          className="btn-plain"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '6px',
            padding: '8px 0',
            zIndex: 9999,
            cursor: 'pointer',
            minWidth: '120px',
            border: 'none',
          }}
          onClick={() => handleDeleteNote(contextMenu.noteId)}
        >
          <div
            style={{
              padding: '8px 16px',
              color: '#ff4d4f',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {t('workspace.detail.deleteNote', 'Delete note')}
          </div>
        </button>
      )}

      {showRenameModal && (
        <div className="workspace-modal-overlay">
          <div
            className="workspace-modal"
            style={{ width: '400px', margin: 'auto' }}
          >
            <header className="workspace-modal-head">
              <h2>{t('workspace.detail.rename', 'Rename Workspace')}</h2>
            </header>
            <div className="workspace-modal-body" style={{ padding: '24px' }}>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '16px',
                  boxSizing: 'border-box',
                }}
                // 重命名弹窗打开后光标就该落在输入框里，
                // 这不是页面加载时抢焦点，规则的顾虑在这里不成立。
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    detail.renameWorkspace(renameInput);
                    setShowRenameModal(false);
                  }
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                }}
              >
                <button
                  className="ws-btn"
                  onClick={() => setShowRenameModal(false)}
                  type="button"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  className="ws-btn ws-btn-primary"
                  onClick={() => {
                    detail.renameWorkspace(renameInput);
                    setShowRenameModal(false);
                  }}
                  type="button"
                >
                  {t('common.confirm', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="workspace-modal-overlay">
          <div
            className="workspace-modal"
            style={{ width: '400px', margin: 'auto' }}
          >
            <header className="workspace-modal-head">
              <h2>
                {t('workspace.detail.deleteWorkspace', 'Delete Workspace')}
              </h2>
            </header>
            <div className="workspace-modal-body" style={{ padding: '24px' }}>
              <p style={{ marginBottom: '16px', lineHeight: '1.5' }}>
                {t(
                  'workspace.detail.deleteConfirm',
                  'Are you sure you want to delete this workspace and all its notes?',
                )}
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                }}
              >
                <button
                  className="ws-btn"
                  onClick={() => setShowDeleteModal(false)}
                  type="button"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  className="ws-btn ws-btn-primary"
                  style={{
                    backgroundColor: '#ff4d4f',
                    color: 'white',
                    border: 'none',
                  }}
                  onClick={() => {
                    detail.deleteWorkspace();
                    setShowDeleteModal(false);
                  }}
                  type="button"
                >
                  {t('workspace.detail.deleteWorkspace', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
