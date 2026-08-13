import { useEffect, useState, useRef } from 'react';
import { AskAIMessage, AskAIResult, AskAINote } from '../../AskAI/AskAITypes';
import '../../AskAI/AskAIChat.css';

type Props = {
  selectedNoteIds: number[];
  workspaceId: number;
  onClose: () => void;
};

export default function WorkspaceMultiNoteModal({ selectedNoteIds, workspaceId, onClose }: Props) {
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
          content: '请针对我选取的笔记进行交叉比对与关联分析',
          createdAt: new Date().toISOString()
        };
        setMessages([userMsg]);

        const result = (await window.electron.askAI.ask({
          workspaceId,
          noteIds: selectedNoteIds,
          question: '请针对我选取的笔记进行交叉比对与关联分析',
          scope: 'multi-note'
        })) as AskAIResult;

        if (!active) return;
        setMessages(result.messages);
      } catch (err) {
        console.error('Multi-note analysis failed:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setMessages(prev => [...prev, {
          id: Date.now(),
          conversationId: 0,
          role: 'assistant',
          content: `❌ 分析失败：\n${errorMessage}\n\n（提示：你可能尚未在设置中下载或启用 LLM 模型）`,
          createdAt: new Date().toISOString()
        }]);
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
          <h2>多笔记关联分析</h2>
          <button type="button" onClick={onClose} className="ws-btn">
            关闭
          </button>
        </header>

        <div className="ask-ai-chat-messages workspace-modal-body" ref={scrollRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`ask-ai-chat-bubble ask-ai-chat-bubble-${msg.role}`}>
              <div className="ask-ai-chat-bubble-content">
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="ask-ai-chat-bubble ask-ai-chat-bubble-assistant">
              <div className="ask-ai-chat-bubble-content workspace-modal-pending">
                正在分析关联性…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
