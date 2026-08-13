import { useTranslation } from 'react-i18next';
import { AskAIConversation, AskAINote, formatAskAIDate } from '../AskAITypes';

type AskAINotesPanelProps = {
  notes: AskAINote[];
  conversations: AskAIConversation[];
  selectedNoteId: number | null;
  onAddNote: () => void;
  onSelectNote: (noteId: number) => void;
  onOpenConversation: (conversationId: number) => void;
};

export default function AskAINotesPanel({
  notes,
  conversations,
  selectedNoteId,
  onAddNote,
  onSelectNote,
  onOpenConversation,
}: AskAINotesPanelProps) {
  const { t } = useTranslation();

  return (
    <aside className="ask-ai-library">
      <header className="ask-ai-library-header">
        <div>
          <span>Ask AI</span>
          <h2>{t('studio.library.title')}</h2>
        </div>
        <button
          type="button"
          onClick={onAddNote}
          aria-label={t('studio.library.add')}
        >
          ＋
        </button>
      </header>

      <div className="ask-ai-note-list">
        {notes.length === 0 ? (
          <div className="ask-ai-empty">
            <strong>{t('studio.library.empty.title')}</strong>
            <span>{t('studio.library.empty.description')}</span>
          </div>
        ) : (
          notes.map((note) => (
            <button
              type="button"
              key={note.id}
              className={selectedNoteId === note.id ? 'active' : ''}
              onClick={() => onSelectNote(note.id)}
            >
              <strong>{note.name}</strong>
              <span>
                {note.transcriptPreview || t('studio.library.noSummary')}
              </span>
              <time>{formatAskAIDate(note.updatedAt)}</time>
            </button>
          ))
        )}
      </div>

      {conversations.length > 0 && (
        <details className="ask-ai-recents">
          <summary>{t('studio.library.recent')}</summary>
          {conversations.slice(0, 6).map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              onClick={() => onOpenConversation(conversation.id)}
            >
              <strong>{conversation.name}</strong>
              <time>{formatAskAIDate(conversation.updatedAt)}</time>
            </button>
          ))}
        </details>
      )}
    </aside>
  );
}
