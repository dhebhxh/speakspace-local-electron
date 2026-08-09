import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

type AskAIScope = 'note' | 'workspace';

type AskAINote = {
  id: number;
  workspaceId: number | null;
  name: string;
  transcript: string;
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
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteName, setNoteName] = useState('');
  const [noteTranscript, setNoteTranscript] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || null,
    [notes, selectedNoteId],
  );

  async function loadNotes(selectedId?: number) {
    const list = await window.electron.askAI.listNotes();

    setNotes(list);
    setSelectedNoteId(
      (currentNoteId) => selectedId || currentNoteId || list[0]?.id || null,
    );
  }

  async function loadConversations() {
    const list = await window.electron.askAI.listConversations();

    setConversations(list);
  }

  useEffect(() => {
    loadNotes();
    loadConversations();
  }, []);

  function resetActiveChat() {
    setActiveConversation(null);
    setMessages([]);
    setSources([]);
  }

  function handleNoteSelect(noteId: number) {
    setSelectedNoteId(noteId);
    setScope('note');
    setStatus('');
    resetActiveChat();
  }

  async function handleConversationOpen(conversationId: number) {
    setStatus('');

    const result = await window.electron.askAI.getConversation(conversationId);

    setActiveConversation(result.conversation);
    setMessages(result.messages);
    setSources(result.sources || []);

    if (result.sources?.[0]) {
      setSelectedNoteId(result.sources[0].id);
    }
  }

  function handleNewConversation() {
    resetActiveChat();
    setStatus('');
  }

  function handleAddNoteOpen() {
    setIsAddingNote(true);
    setStatus('');
  }

  function handleAddNoteClose() {
    setIsAddingNote(false);
    setNoteName('');
    setNoteTranscript('');
    setStatus('');
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTranscript = noteTranscript.trim();

    if (!cleanTranscript || isSavingNote) {
      setStatus('Add note text first.');
      return;
    }

    setIsSavingNote(true);
    setStatus('Saving note...');

    try {
      const createdNote = await window.electron.askAI.createNote({
        name: noteName,
        transcript: cleanTranscript,
      });

      await loadNotes(createdNote.id);
      setScope('note');
      setNoteName('');
      setNoteTranscript('');
      setIsAddingNote(false);
      resetActiveChat();
      setStatus('Note saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Note save failed.');
    } finally {
      setIsSavingNote(false);
    }
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

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="ask-ai-page">
      <aside className="ask-ai-library">
        <div className="ask-ai-library-header">
          <div>
            <p>Notes</p>
            <h2>Library</h2>
          </div>
          <button
            type="button"
            className="ask-ai-icon-button"
            onClick={handleAddNoteOpen}
          >
            +
          </button>
        </div>

        <div className="ask-ai-notes-list">
          {notes.length === 0 ? (
            <div className="ask-ai-empty-panel">
              <h3>No notes yet</h3>
              <p>Add a note to ask questions about it.</p>
              <button type="button" onClick={handleAddNoteOpen}>
                Add Note
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                type="button"
                key={note.id}
                className={
                  selectedNoteId === note.id
                    ? 'ask-ai-note-card active'
                    : 'ask-ai-note-card'
                }
                onClick={() => handleNoteSelect(note.id)}
              >
                <span>{note.name}</span>
                <small>
                  {note.transcriptPreview || 'No transcript preview'}
                </small>
                <time>{formatDate(note.updatedAt)}</time>
              </button>
            ))
          )}
        </div>

        {conversations.length > 0 && (
          <details className="ask-ai-recent-chats">
            <summary>Recent Ask AI</summary>
            {conversations.slice(0, 6).map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => handleConversationOpen(conversation.id)}
              >
                <span>{conversation.name}</span>
                <small>{formatDate(conversation.updatedAt)}</small>
              </button>
            ))}
          </details>
        )}
      </aside>

      <main className="ask-ai-main">
        <header className="ask-ai-topbar">
          <div>
            <p>Ask AI</p>
            <h1>{selectedNote?.name || 'Select a note'}</h1>
          </div>
          <div className="ask-ai-topbar-actions">
            <button
              type="button"
              className="ask-ai-ghost-button"
              onClick={handleNewConversation}
            >
              New Chat
            </button>
            <button type="button" onClick={handleAddNoteOpen}>
              Add Note
            </button>
          </div>
        </header>

        <section className="ask-ai-workspace">
          <article className="ask-ai-note-detail">
            {selectedNote ? (
              <>
                <div className="ask-ai-note-header">
                  <h2>{selectedNote.name}</h2>
                  <span>{formatDate(selectedNote.updatedAt)}</span>
                </div>
                <section>
                  <h3>Transcript</h3>
                  <p>
                    {selectedNote.transcript || selectedNote.transcriptPreview}
                  </p>
                </section>
              </>
            ) : (
              <div className="ask-ai-empty-panel">
                <h3>No note selected</h3>
                <p>Choose a saved note or add one to start testing Ask AI.</p>
              </div>
            )}
          </article>

          <aside className="ask-ai-qa-section">
            <div className="ask-ai-qa-header">
              <div>
                <h2>
                  {scope === 'workspace'
                    ? 'Ask Workspace'
                    : 'Ask About This Note'}
                </h2>
                <p>
                  {scope === 'workspace'
                    ? `${notes.length} saved notes`
                    : selectedNote?.name || 'No note selected'}
                </p>
              </div>

              <div
                className="ask-ai-scope-switch"
                role="group"
                aria-label="Ask AI scope"
              >
                <button
                  type="button"
                  className={scope === 'note' ? 'active' : ''}
                  onClick={() => setScope('note')}
                >
                  This Note
                </button>
                <button
                  type="button"
                  className={scope === 'workspace' ? 'active' : ''}
                  onClick={() => setScope('workspace')}
                >
                  Workspace
                </button>
              </div>
            </div>

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
                  <p>Ask a question grounded in your saved notes.</p>
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
                  scope === 'workspace'
                    ? 'Ask across all saved notes...'
                    : 'For example: What should I do after this meeting?'
                }
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
              />

              <button
                type="button"
                className="ask-ai-send-button"
                onClick={handleSend}
                disabled={isSending || !question.trim()}
              >
                {isSending ? '...' : 'Ask'}
              </button>
            </footer>

            <div className="ask-ai-status">{status}</div>
          </aside>
        </section>
      </main>

      {isAddingNote && (
        <div className="ask-ai-modal-backdrop">
          <form className="ask-ai-modal" onSubmit={handleCreateNote}>
            <div className="ask-ai-modal-header">
              <div>
                <p>Notes Library</p>
                <h2>Add Note</h2>
              </div>
              <button
                type="button"
                className="ask-ai-icon-button"
                onClick={handleAddNoteClose}
              >
                x
              </button>
            </div>

            <label htmlFor="ask-ai-note-title">
              Title
              <input
                id="ask-ai-note-title"
                type="text"
                value={noteName}
                placeholder="Lecture notes"
                onChange={(event) => setNoteName(event.target.value)}
              />
            </label>

            <label htmlFor="ask-ai-note-transcript">
              Note
              <textarea
                id="ask-ai-note-transcript"
                value={noteTranscript}
                placeholder="Paste or type note text..."
                onChange={(event) => setNoteTranscript(event.target.value)}
              />
            </label>

            <div className="ask-ai-modal-actions">
              <button
                type="button"
                className="ask-ai-ghost-button"
                onClick={handleAddNoteClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingNote || !noteTranscript.trim()}
              >
                {isSavingNote ? 'Saving' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
