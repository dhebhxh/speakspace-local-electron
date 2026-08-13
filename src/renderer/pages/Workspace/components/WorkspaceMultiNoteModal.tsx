import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AskAIMessage, AskAIResult, AskAINote } from '../../AskAI/AskAITypes';
import '../../AskAI/AskAIChat.css';

type Props = {
  selectedNoteIds: number[];
  workspaceId: number;
  onClose: () => void;
};

export default function WorkspaceMultiNoteModal({
  selectedNoteIds,
  workspaceId,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AskAIMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        // Add user prompt to messages immediately
        const userMsg: AskAIMessage = {
          id: Date.now(),
          conversationId: 0,
          role: 'user',
          content: t('workspace.analysis.prompt'),
          createdAt: new Date().toISOString(),
        };
        setMessages([userMsg]);

        const result = (await window.electron.askAI.ask({
          workspaceId,
          noteIds: selectedNoteIds,
          question: t('workspace.analysis.prompt'),
          scope: 'multi-note',
        })) as AskAIResult;

        if (!active) return;
        setMessages(result.messages);
      } catch (err) {
        console.error('Multi-note analysis failed:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            conversationId: 0,
            role: 'assistant',
            content: t('workspace.analysis.error', { error: errorMessage }),
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAnalysis();

    return () => {
      active = false;
    };
  }, [selectedNoteIds, t, workspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <header style={headerStyle}>
          <h2>{t('workspace.analysis.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm"
          >
            {t('workspace.analysis.close')}
          </button>
        </header>

        <div
          className="ask-ai-chat-messages"
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`ask-ai-chat-bubble ask-ai-chat-bubble-${msg.role}`}
            >
              <div className="ask-ai-chat-bubble-content">
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="ask-ai-chat-bubble ask-ai-chat-bubble-assistant">
              <div
                className="ask-ai-chat-bubble-content"
                style={{ opacity: 0.6 }}
              >
                {t('workspace.analysis.loading')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: '80%',
  maxWidth: '800px',
  height: '70%',
  backgroundColor: 'var(--surface)',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--surface-strong)',
};
