import { useState } from 'react';
import AskAIChatPanel from './components/AskAIChatPanel';
import AskAICreateNoteDialog from './components/AskAICreateNoteDialog';
import AskAINotePreview from './components/AskAINotePreview';
import AskAINotesPanel from './components/AskAINotesPanel';
import useAskAIPage from './useAskAIPage';
import './AskAIPage.css';
import './AskAIChat.css';
import './AskAIDialog.css';

export default function AskAIPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const page = useAskAIPage();

  return (
    <section className="ask-ai-page">
      <AskAINotesPanel
        notes={page.notes}
        conversations={page.conversations}
        selectedNoteId={page.selectedNote?.id ?? null}
        onAddNote={() => setShowCreateDialog(true)}
        onSelectNote={page.selectNote}
        onOpenConversation={page.openConversation}
      />

      <main className="ask-ai-main">
        <header className="ask-ai-toolbar">
          <div>
            <span>SpeakSpace</span>
            <strong>基于本地笔记的 AI 问答</strong>
          </div>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={page.resetChat}
            >
              新会话
            </button>
            <button type="button" onClick={() => setShowCreateDialog(true)}>
              新增笔记
            </button>
          </div>
        </header>

        <div className="ask-ai-content">
          <AskAINotePreview note={page.selectedNote} />
          <AskAIChatPanel
            messages={page.messages}
            sources={page.sources}
            selectedNote={page.selectedNote}
            allNotes={page.notes}
            scope={page.scope}
            status={page.status}
            isSending={page.isSending}
            onScopeChange={page.setScope}
            onAsk={page.ask}
          />
        </div>
      </main>

      {showCreateDialog && (
        <AskAICreateNoteDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={page.createNote}
        />
      )}
    </section>
  );
}
