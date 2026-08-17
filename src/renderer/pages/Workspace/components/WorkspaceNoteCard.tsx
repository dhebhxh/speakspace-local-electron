import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, Mic, AlignLeft, Sparkles, MessageSquare } from 'lucide-react';
import { NoteItem, WorkspaceController } from '../WorkspaceController';
import { WorkspaceTemplate } from '../WorkspaceWorkflowController';
import KnowledgeOutputPanel from './KnowledgeOutputPanel';
import WorkspaceAudioPlayer from './WorkspaceAudioPlayer';

type Props = {
  workspaceId: number;
  note: NoteItem;
  templates: WorkspaceTemplate[];
  generating: boolean;
  isSelected?: boolean;
  onToggleSelection?: (noteId: number) => void;
  onContextMenu?: (noteId: number, e: React.MouseEvent) => void;
  onGenerate(noteId: number, templateId: number): Promise<void>;
};

/** 协调笔记音视频、转录、派生内容，对应展示保留为独立组件。 */
export default function WorkspaceNoteCard({
  workspaceId,
  note,
  templates,
  generating,
  isSelected = false,
  onToggleSelection,
  onContextMenu,
  onGenerate,
}: Props) {
  const { t, i18n } = useTranslation();
  const handleExport = (format: 'word' | 'pdf') => {
    window.electron.export.note({
      title: note.name || t('workspace.note.unnamed'),
      transcript: note.transcript,
      subnotes: note.subnotes.map(s => ({ type: s.content_type, content: s.content })),
      format
    }).catch(console.error);
  };

  return (
    <article 
      className={`workspace-detail-note ${isSelected ? 'selected' : ''}`} 
      id={`workspace-note-${note.id}`}
      onContextMenu={(e) => onContextMenu && onContextMenu(note.id, e)}
    >
      <header className="workspace-note-head">
        {onToggleSelection && (
          <label className="workspace-note-pick">
            <input
              aria-label={t('workspace.note.select')}
              checked={isSelected}
              onChange={() => onToggleSelection(note.id)}
              type="checkbox"
            />
          </label>
        )}
        <div className="workspace-note-identity">
          {note.is_pinned ? (
            <span className="workspace-note-kind" title={t('workspace.note.pin')}>
              <Pin size={14} style={{ marginRight: 4 }} /> {t('workspace.detail.pinnedLabel')}
            </span>
          ) : null}
          <h2>{note.name || t('workspace.note.unnamed')}</h2>
        </div>
        <div className="workspace-note-tools">
          <button
            className="ws-btn ws-btn-quiet"
            onClick={() => handleExport('word')}
            title={t('workspace.note.exportWordTitle')}
            type="button"
          >
            {t('workspace.note.exportWord')}
          </button>
          <button
            className="ws-btn ws-btn-quiet"
            onClick={() => handleExport('pdf')}
            title={t('workspace.note.exportPdfTitle')}
            type="button"
          >
            {t('workspace.note.exportPdf')}
          </button>
          <time dateTime={note.updated_at} title={t('workspace.detail.updated')}>
            {WorkspaceController.formatDate(note.updated_at, 'short', i18n.language)}
          </time>
        </div>
      </header>

      <div className="workspace-note-audio">
        <span aria-hidden="true" className="ws-label" title={t('workspace.note.audioLabel')}>
          <Mic size={16} />
        </span>
        <WorkspaceAudioPlayer workspaceId={workspaceId} note={note} />
      </div>

      <div className="workspace-content-grid">
        <section className="workspace-transcript-section">
          <h3>
            <AlignLeft size={16} style={{ marginRight: 6 }} />
            {t('workspace.note.transcription')}
          </h3>
          <p className="workspace-transcript">
            {note.transcript || t('workspace.note.noTranscription')}
          </p>
        </section>

        <section className="workspace-knowledge-section">
          {note.subnotes.filter(s => s.content_type === 'note').length > 0 && (
            <div className="workspace-subnotes-list">
              <h3>
                <Sparkles size={16} style={{ marginRight: 6 }} />
                {t('workspace.note.subNotes')}
              </h3>
              {note.subnotes.filter(s => s.content_type === 'note').map(s => (
                <div key={s.id} className="workspace-subnote-item">
                  <span className="workspace-subnote-badge">{s.template_name || 'Sub-note'}</span>
                  <div className="workspace-subnote-content">{s.content}</div>
                </div>
              ))}
            </div>
          )}

          {note.subnotes.filter(s => s.content_type === 'chat').length > 0 && (
            <div className="workspace-subnotes-list">
              <h3>
                <MessageSquare size={16} style={{ marginRight: 6 }} />
                {t('workspace.note.aiChat')}
              </h3>
              {note.subnotes.filter(s => s.content_type === 'chat').map(s => (
                <div key={s.id} className="workspace-subnote-item is-chat">
                  <div className="workspace-subnote-content">{s.content}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <KnowledgeOutputPanel
          generating={generating}
          note={note}
          onGenerate={onGenerate}
          templates={templates}
        />

        <section className="workspace-conversation-section">
          <h3>💬 {t('workspace.note.aiChat', 'AI 对话')}</h3>
          {note.conversations.length === 0 ? (
            <span className="workspace-content-empty">{t('workspace.knowledge.empty', '暂无')}</span>
          ) : (
            <div className="workspace-content-stack">
              {note.conversations.map((conversation) => (
                <details
                  className="workspace-conversation"
                  key={conversation.id}
                >
                  <summary>
                    {conversation.name}
                    <span className="workspace-conversation-count">
                      💬 {conversation.messages.length}
                    </span>
                  </summary>
                  <div>
                    {conversation.messages.map((message) => (
                      <p key={message.id}>
                        <strong>{message.role}</strong>
                        {message.content}
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
