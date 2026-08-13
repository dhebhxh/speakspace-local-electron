import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <span>{t('studio.chat.eyebrow')}</span>
          <h2>
            {scope === 'note'
              ? t('studio.chat.title.note')
              : t('studio.chat.title.workspace')}
          </h2>
          <p>
            {scope === 'note'
              ? selectedNote?.name || t('studio.chat.start')
              : t('studio.chat.workspaceCount', { count: workspaceNoteCount })}
          </p>
        </div>
        <div
          className="ask-ai-scope"
          role="group"
          aria-label={t('studio.chat.scopeLabel')}
        >
          <button
            type="button"
            className={scope === 'note' ? 'active' : ''}
            onClick={() => onScopeChange('note')}
          >
            {t('studio.chat.scope.note')}
          </button>
          <button
            type="button"
            className={scope === 'workspace' ? 'active' : ''}
            onClick={() => onScopeChange('workspace')}
          >
            {t('studio.chat.scope.workspace')}
          </button>
        </div>
      </header>

      {sources.length > 0 && (
        <div className="ask-ai-sources">
          <span>{t('studio.chat.sources')}</span>
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
            <strong>{t('studio.chat.empty.title')}</strong>
            <span>{t('studio.chat.empty.description')}</span>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={message.role}>
              <span>
                {message.role === 'assistant' ? 'AI' : t('studio.chat.you')}
              </span>
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
            {t('studio.chat.linkedNote')} <strong>{selectedNote.name}</strong>
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
              {t('studio.chat.stop')} {formatElapsed(recording.elapsedMs)}
            </button>
          ) : (
            <button
              type="button"
              className="studio-record-button"
              onClick={onStartRecording}
              disabled={recordingBusy}
              aria-label={t('studio.chat.startRecording')}
            >
              <span className="studio-record-mic" aria-hidden="true">
                ●
              </span>
              {t('studio.chat.record')}
            </button>
          )}
          <button
            type="button"
            className="studio-upload-button"
            onClick={onUploadAudio}
            disabled={recording.active || recordingBusy}
          >
            {t('studio.chat.upload')}
          </button>
        </div>

        <textarea
          value={question}
          placeholder={
            recording.active
              ? t('studio.chat.placeholder.recording')
              : t('studio.chat.placeholder.question')
          }
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!selectedNote || isSending || recording.active}
        />
        <button
          type="submit"
          className="studio-send-button"
          disabled={
            !selectedNote || !question.trim() || isSending || recording.active
          }
        >
          {isSending ? t('studio.chat.thinking') : t('studio.chat.send')}
        </button>
      </form>
      <div className="ask-ai-status" role="status">
        {recording.active ? t('studio.chat.recordingStatus') : status}
      </div>
    </section>
  );
}
