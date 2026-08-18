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
          content: t('workspace.multi.prompt'),
          createdAt: new Date().toISOString(),
        };
        setMessages([userMsg]);

        const result = (await window.electron.askAI.ask({
          workspaceId,
          noteIds: selectedNoteIds,
          question: t('workspace.multi.prompt'),
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
            content: t('workspace.multi.error').replace(
              '${errorMessage}',
              errorMessage,
            ),
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
  }, [selectedNoteIds, workspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div className="workspace-modal-overlay">
      <div className="workspace-modal">
        <header className="workspace-modal-head">
          <h2>{t('workspace.multi.title')}</h2>
          <button type="button" onClick={onClose} className="ws-btn">
            {t('workspace.multi.close')}
          </button>
        </header>

        <div
          className="ask-ai-chat-messages workspace-modal-body"
          ref={scrollRef}
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
              <div className="ask-ai-chat-bubble-content workspace-modal-pending">
                {t('workspace.multi.loading', 'Generating...')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
