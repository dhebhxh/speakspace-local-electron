import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { AskAIMessage, AskAINote, AskAIScope } from '../../AskAI/AskAITypes';
import TTSPlayButton from '../../../tts/TTSPlayButton';

type RecordingUiState = {
  active: boolean;
  busy: boolean;
  elapsedMs: number;
  error: string | null;
};

type StudioChatPanelProps = {
  messages: AskAIMessage[];
  sources: AskAINote[];
  selectedNote: AskAINote | null;
  allNotes: AskAINote[];
  scope: AskAIScope;
  status: string;
  isSending: boolean;
  recording: RecordingUiState;
  onScopeChange: (scope: AskAIScope) => void;
  onAsk: (question: string) => Promise<boolean>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onUploadAudio: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function StudioChatPanel({
  messages,
  sources,
  selectedNote,
  allNotes,
  scope,
  status,
  isSending,
  recording,
  onScopeChange,
  onAsk,
  onStartRecording,
  onStopRecording,
  onUploadAudio,
}: StudioChatPanelProps) {
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

  const recordingBusy = recording.busy;

  return (
    <section className="studio-chat">
      <header className="studio-chat-header">
        <div className="studio-chat-heading">
          <span>本地问答 · SpeakSpace</span>
          <h2>{scope === 'note' ? '询问当前笔记' : '询问整个工作区'}</h2>
          <p>
            {scope === 'note'
              ? selectedNote?.name || '录一段音或从左侧选择一条笔记开始'
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

      <div className="ask-ai-messages studio-chat-messages">
        {messages.length === 0 ? (
          <div className="ask-ai-empty">
            <strong>还没有对话</strong>
            <span>
              点击下方麦克风录一段语音，转录整理后即可就地提问；也可以上传音频或选择已有笔记。
            </span>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={message.role}>
              <span>{message.role === 'assistant' ? 'AI' : '你'}</span>
              <p>{message.content}</p>
              {message.role === 'assistant' && (
                <TTSPlayButton text={message.content} />
              )}
            </article>
          ))
        )}
      </div>

      {selectedNote && (
        <div className="studio-linked-note" title={selectedNote.name}>
          <span className="studio-linked-note__icon" aria-hidden="true">
            ◆
          </span>
          <span className="studio-linked-note__label">
            已关联笔记：<strong>{selectedNote.name}</strong>
          </span>
        </div>
      )}

      {recording.error && (
        <p className="studio-record-error" role="alert">
          {recording.error}
        </p>
      )}

      <form className="studio-composer" onSubmit={handleSubmit}>
        <div className="studio-composer-tools">
          {recording.active ? (
            <button
              type="button"
              className="studio-record-button is-recording"
              onClick={onStopRecording}
              disabled={recordingBusy}
            >
              <span className="studio-record-dot" aria-hidden="true" />
              停止 {formatElapsed(recording.elapsedMs)}
            </button>
          ) : (
            <button
              type="button"
              className="studio-record-button"
              onClick={onStartRecording}
              disabled={recordingBusy}
              aria-label="开始录音"
            >
              <span className="studio-record-mic" aria-hidden="true">
                ●
              </span>
              录音
            </button>
          )}
          <button
            type="button"
            className="studio-upload-button"
            onClick={onUploadAudio}
            disabled={recording.active || recordingBusy}
          >
            上传音频
          </button>
        </div>

        <textarea
          value={question}
          placeholder={
            recording.active
              ? '正在录音…结束后会弹出确认窗口'
              : '输入问题；Enter 发送，Shift+Enter 换行'
          }
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!selectedNote || isSending || recording.active}
        />
        <button
          type="submit"
          className="studio-send-button"
          disabled={
            !selectedNote ||
            !question.trim() ||
            isSending ||
            recording.active
          }
        >
          {isSending ? '思考中…' : '发送'}
        </button>
      </form>
      <div className="ask-ai-status" role="status">
        {recording.active
          ? '录音中…点击“停止”结束并整理内容'
          : status}
      </div>
    </section>
  );
}
