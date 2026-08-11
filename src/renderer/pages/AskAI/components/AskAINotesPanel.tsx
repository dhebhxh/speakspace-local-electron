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
  return (
    <aside className="ask-ai-library">
      <header className="ask-ai-library-header">
        <div>
          <span>Ask AI</span>
          <h2>笔记库</h2>
        </div>
        <button type="button" onClick={onAddNote} aria-label="新增笔记">
          ＋
        </button>
      </header>

      <div className="ask-ai-note-list">
        {notes.length === 0 ? (
          <div className="ask-ai-empty">
            <strong>还没有笔记</strong>
            <span>新增一条笔记后即可向本地模型提问。</span>
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
              <span>{note.transcriptPreview || '暂无摘要'}</span>
              <time>{formatAskAIDate(note.updatedAt)}</time>
            </button>
          ))
        )}
      </div>

      {conversations.length > 0 && (
        <details className="ask-ai-recents">
          <summary>最近会话</summary>
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
