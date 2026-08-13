import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { AskAIMessage, AskAINote, AskAIScope } from '../AskAITypes';
import TTSPlayButton from '../../../tts/TTSPlayButton';
import CopyButton from '../../../components/CopyButton';

type AskAIChatPanelProps = {
  messages: AskAIMessage[];
  sources: AskAINote[];
  selectedNote: AskAINote | null;
  allNotes: AskAINote[];
  scope: AskAIScope;
  status: string;
  isSending: boolean;
  onScopeChange: (scope: AskAIScope) => void;
  onAsk: (question: string) => Promise<boolean>;
};

export default function AskAIChatPanel({
  messages,
  sources,
  selectedNote,
  allNotes,
  scope,
  status,
  isSending,
  onScopeChange,
  onAsk,
}: AskAIChatPanelProps) {
  const [question, setQuestion] = useState('');
  const workspaceNoteCount = useMemo(
    () =>
      allNotes.filter((note) => note.workspaceId === selectedNote?.workspaceId)
        .length,
    [allNotes, selectedNote?.workspaceId],
  );

  async function submitQuestion() {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || isSending) return;
    if (await onAsk(cleanQuestion)) setQuestion('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitQuestion();
    }
  }

  return (
    <section className="ask-ai-chat">
      <header className="ask-ai-chat-header">
        <div>
          <span>本地问答</span>
          <h2>{scope === 'note' ? '询问当前笔记' : '询问整个工作区'}</h2>
          <p>
            {scope === 'note'
              ? selectedNote?.name || '尚未选择笔记'
              : `${workspaceNoteCount} 条工作区笔记`}
          </p>
        </div>
        <div className="ask-ai-scope" role="group" aria-label="问答范围">
          <button
            type="button"
            className={scope === 'note' ? 'active' : ''}
            onClick={() => onScopeChange('note')}
          >
            当前笔记
          </button>
          <button
            type="button"
            className={scope === 'workspace' ? 'active' : ''}
            onClick={() => onScopeChange('workspace')}
          >
            工作区
          </button>
        </div>
      </header>

      {sources.length > 0 && (
        <div className="ask-ai-sources">
          <span>引用</span>
          {sources.map((source) => (
            <span key={source.id} title={source.transcriptPreview}>
              {source.name}
            </span>
          ))}
        </div>
      )}

      <div className="ask-ai-messages">
        {messages.length === 0 ? (
          <div className="ask-ai-empty">
            <strong>还没有消息</strong>
            <span>回答只使用所选的本地笔记内容。</span>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={message.role}>
              <span>{message.role === 'assistant' ? 'AI' : '你'}</span>
              <p>{message.content}</p>
              {message.role === 'assistant' && (
                <div className="message-actions">
                  <TTSPlayButton text={message.content} />
                  <CopyButton text={message.content} />
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <form className="ask-ai-composer" onSubmit={handleSubmit}>
        <textarea
          value={question}
          placeholder="输入问题；Enter 发送，Shift+Enter 换行"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!selectedNote || isSending}
        />
        <button
          type="submit"
          disabled={!selectedNote || !question.trim() || isSending}
        >
          {isSending ? '思考中…' : '提问'}
        </button>
      </form>
      <div className="ask-ai-status" role="status">
        {status}
      </div>
    </section>
  );
}
