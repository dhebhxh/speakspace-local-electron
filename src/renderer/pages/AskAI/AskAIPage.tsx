import { useEffect, useMemo, useState } from 'react';

type AskAIScope = 'note' | 'workspace';

type AskAINote = {
  id: number;
  workspaceId: number | null;
  name: string;
  transcriptPreview: string;
  updatedAt: string;
};

type AskAIConversation = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type AskAIMessage = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
};

type AskAIResult = {
  conversation: AskAIConversation;
  messages: AskAIMessage[];
  answer: string;
  modelName: string | null;
  scope: AskAIScope;
  sources: AskAINote[];
};

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AskAIPage() {
  const [notes, setNotes] = useState<AskAINote[]>([]);

  const [conversations, setConversations] = useState<AskAIConversation[]>([]);

  const [activeConversation, setActiveConversation] =
    useState<AskAIConversation | null>(null);

  const [messages, setMessages] = useState<AskAIMessage[]>([]);

  const [sources, setSources] = useState<AskAINote[]>([]);

  const [scope, setScope] = useState<AskAIScope>('note');

  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const [question, setQuestion] = useState('');

  const [status, setStatus] = useState('');

  const [isSending, setIsSending] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || null,
    [notes, selectedNoteId],
  );

  async function loadNotes() {
    const list = await window.electron.askAI.listNotes();

    setNotes(list);
    setSelectedNoteId((currentNoteId) => currentNoteId || list[0]?.id || null);
  }

  async function loadConversations() {
    const list = await window.electron.askAI.listConversations();

    setConversations(list);
  }

  useEffect(() => {
    loadNotes();
    loadConversations();
  }, []);

  async function handleConversationOpen(conversationId: number) {
    setStatus('');

    const result = await window.electron.askAI.getConversation(conversationId);

    setActiveConversation(result.conversation);
    setMessages(result.messages);
    setSources(result.sources || []);
  }

  function handleNewConversation() {
    setActiveConversation(null);
    setMessages([]);
    setSources([]);
    setStatus('');
  }

  async function handleSend() {
    const cleanQuestion = question.trim();

    if (!cleanQuestion || isSending) {
      return;
    }

    setIsSending(true);
    setStatus('Thinking...');

    try {
      const result: AskAIResult = await window.electron.askAI.ask({
        conversationId: activeConversation?.id || null,
        noteId: selectedNoteId,
        question: cleanQuestion,
        scope,
      });

      setActiveConversation(result.conversation);
      setMessages(result.messages);
      setSources(result.sources || []);
      setQuestion('');
      setStatus(result.modelName ? `Answered with ${result.modelName}` : '');

      await loadConversations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ask AI failed.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="ask-ai-page">
      <aside className="ask-ai-history">
        <div className="ask-ai-history-header">
          <div>
            <h2>Ask AI</h2>
            <p>Local notes</p>
          </div>
          <button
            type="button"
            className="ask-ai-secondary-button"
            onClick={handleNewConversation}
          >
            New
          </button>
        </div>

        <div className="ask-ai-conversation-list">
          {conversations.length === 0 ? (
            <p className="ask-ai-empty">No conversations yet.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={
                  activeConversation?.id === conversation.id
                    ? 'ask-ai-conversation active'
                    : 'ask-ai-conversation'
                }
                onClick={() => {
                  handleConversationOpen(conversation.id);
                }}
              >
                <span>{conversation.name}</span>
                <small>{formatDate(conversation.updatedAt)}</small>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="ask-ai-chat">
        <header className="ask-ai-chat-header">
          <div>
            <h1>{activeConversation?.name || 'Ask AI'}</h1>
            <p>
              {scope === 'note'
                ? selectedNote?.name || 'No current note selected'
                : `${notes.length} saved notes`}
            </p>
          </div>

          <div className="ask-ai-controls">
            <div className="ask-ai-segmented" role="group">
              <button
                type="button"
                className={scope === 'note' ? 'active' : ''}
                onClick={() => setScope('note')}
              >
                Current Note
              </button>
              <button
                type="button"
                className={scope === 'workspace' ? 'active' : ''}
                onClick={() => setScope('workspace')}
              >
                All Notes
              </button>
            </div>

            <select
              value={selectedNoteId || ''}
              onChange={(event) =>
                setSelectedNoteId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              disabled={scope === 'workspace'}
            >
              <option value="">Select note</option>
              {notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        {sources.length > 0 && (
          <div className="ask-ai-sources">
            <span>Sources</span>
            {sources.map((source) => (
              <span
                key={source.id}
                className="ask-ai-source-chip"
                title={source.transcriptPreview}
              >
                {source.name}
              </span>
            ))}
          </div>
        )}

        <div className="ask-ai-messages">
          {messages.length === 0 ? (
            <div className="ask-ai-empty-state">
              <h3>No messages yet</h3>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`ask-ai-message ${message.role}`}
              >
                <span className="ask-ai-message-role">
                  {message.role === 'assistant' ? 'AI' : 'You'}
                </span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>

        <footer className="ask-ai-composer">
          <textarea
            value={question}
            placeholder={
              scope === 'note'
                ? 'Ask about the selected note...'
                : 'Ask across all saved notes...'
            }
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="ask-ai-composer-actions">
            <span>{status}</span>
            <button
              type="button"
              onClick={() => {
                handleSend();
              }}
              disabled={isSending || !question.trim()}
            >
              {isSending ? 'Sending' : 'Send'}
            </button>
          </div>
        </footer>
      </main>
    </section>
  );
}
