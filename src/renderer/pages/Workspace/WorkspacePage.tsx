import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import type { TrashActionResult } from '@shared/types/TrashTypes';
import TrashUndoToast from '../../components/TrashUndoToast';
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
  const location = useLocation();
  const navigate = useNavigate();
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
    revealNote,
  } = detail;
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [noteUndo, setNoteUndo] = useState<TrashActionResult | null>(null);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [noteName, setNoteName] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [createNoteError, setCreateNoteError] = useState('');

  const handleDeleteNote = async (noteId: number) => {
    const result = await detail.moveNoteToTrash(noteId);
    if (result) setNoteUndo(result);
  };

  useEffect(() => {
    const routedNoteId = (location.state as { noteId?: number } | null)?.noteId;
    if (!loading && routedNoteId) {
      revealNote(routedNoteId);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [loading, location.pathname, location.state, navigate, revealNote]);

  const undoDeleteNote = async () => {
    if (!noteUndo) return;
    await window.electron.trash.restore({
      itemType: 'note',
      id: noteUndo.id,
    });
    await detail.reloadNotes();
    revealNote(noteUndo.id);
  };

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
          onSelect={revealNote}
          query={query}
          workspaceId={detail.workspaceId}
        />
        <button
          className="ws-btn ws-btn-primary workspace-create-note-button"
          onClick={() => {
            setCreateNoteError('');
            setShowCreateNoteModal(true);
          }}
          type="button"
        >
          <Plus size={17} /> {t('workspace.note.createButton')}
        </button>
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
            onDelete={handleDeleteNote}
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

      {showCreateNoteModal && (
        <div className="workspace-modal-overlay">
          <form
            aria-labelledby="workspace-create-note-title"
            aria-modal="true"
            className="workspace-modal workspace-create-note-modal"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!noteContent.trim() || creatingNote) return;
              try {
                setCreatingNote(true);
                setCreateNoteError('');
                const noteId = await detail.createNote(noteName, noteContent);
                setShowCreateNoteModal(false);
                setNoteName('');
                setNoteContent('');
                detail.revealNote(noteId);
              } catch (reason) {
                setCreateNoteError(
                  reason instanceof Error
                    ? reason.message
                    : t('workspace.note.createFailed'),
                );
              } finally {
                setCreatingNote(false);
              }
            }}
            role="dialog"
          >
            <header className="workspace-modal-head">
              <h2 id="workspace-create-note-title">
                {t('workspace.note.createTitle')}
              </h2>
            </header>
            <div className="workspace-create-note-body">
              <label htmlFor="workspace-new-note-name">
                <span>{t('workspace.note.nameLabel')}</span>
                <input
                  id="workspace-new-note-name"
                  maxLength={80}
                  onChange={(event) => setNoteName(event.target.value)}
                  placeholder={t('workspace.note.namePlaceholder')}
                  value={noteName}
                />
              </label>
              <label htmlFor="workspace-new-note-content">
                <span>{t('workspace.note.contentLabel')}</span>
                <textarea
                  // The primary field should receive focus when this modal opens.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  id="workspace-new-note-content"
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder={t('workspace.note.contentPlaceholder')}
                  required
                  rows={10}
                  value={noteContent}
                />
              </label>
              {createNoteError && (
                <p className="workspace-detail-error" role="alert">
                  {createNoteError}
                </p>
              )}
              <div className="workspace-create-note-actions">
                <button
                  className="ws-btn"
                  disabled={creatingNote}
                  onClick={() => setShowCreateNoteModal(false)}
                  type="button"
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="ws-btn ws-btn-primary"
                  disabled={!noteContent.trim() || creatingNote}
                  type="submit"
                >
                  {creatingNote
                    ? t('workspace.note.creating')
                    : t('workspace.note.createButton')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showDeleteModal && (
        <div className="workspace-modal-overlay">
          <div
            aria-labelledby="workspace-delete-confirm-title"
            aria-modal="true"
            className="workspace-modal workspace-confirm-modal"
            role="dialog"
          >
            <header className="workspace-modal-head">
              <h2 id="workspace-delete-confirm-title">
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
                  className="ws-btn ws-btn-danger-solid"
                  onClick={async () => {
                    const moved = await detail.moveWorkspaceToTrash();
                    setShowDeleteModal(false);
                    if (moved) {
                      navigate('/Workspace', {
                        state: { trashUndo: moved },
                      });
                    }
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

      {noteUndo && (
        <TrashUndoToast
          dismissLabel={t('trash.action.dismiss')}
          message={t('trash.notice.noteMoved', {
            name: noteUndo.name || t('workspace.note.unnamed'),
          })}
          onDismiss={() => setNoteUndo(null)}
          onUndo={undoDeleteNote}
          undoLabel={t('trash.action.undo')}
          undoingLabel={t('trash.action.restoring')}
        />
      )}
    </section>
  );
}
