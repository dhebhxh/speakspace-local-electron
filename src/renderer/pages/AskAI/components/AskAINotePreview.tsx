import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AskAINote,
  AskAINoteDetail,
  AskAISubnote,
  formatAskAIDate,
} from '../AskAITypes';

type AskAINotePreviewProps = {
  note: AskAINote | null;
};

export default function AskAINotePreview({ note }: AskAINotePreviewProps) {
  const { t } = useTranslation();
  const [subnotes, setSubnotes] = useState<AskAISubnote[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const noteId = note?.id ?? null;

  // 摘要存在 subnotes 表里，列表接口不返回，打开预览时按笔记 id 单独取。
  useEffect(() => {
    if (noteId === null) {
      setSubnotes([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingSummary(true);
    window.electron.askAI
      .getNoteDetail(noteId)
      .then((detail) => {
        if (cancelled) return null;
        setSubnotes((detail as AskAINoteDetail | null)?.subnotes ?? []);
        setLoadingSummary(false);
        return null;
      })
      .catch(() => {
        if (cancelled) return;
        setSubnotes([]);
        setLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (!note) {
    return (
      <section className="ask-ai-note-preview ask-ai-empty">
        <strong>{t('askAI.preview.emptyTitle')}</strong>
        <span>{t('askAI.preview.emptyDesc')}</span>
      </section>
    );
  }

  const transcript = note.transcript || note.transcriptPreview;

  return (
    <section className="ask-ai-note-preview">
      <header>
        <div>
          <span>{t('askAI.chat.scopeBtnNote')}</span>
          <h1>{note.name}</h1>
        </div>
        <time>{formatAskAIDate(note.updatedAt)}</time>
      </header>

      <section className="ask-ai-note-section">
        <h2>{t('askAI.preview.summaryTitle')}</h2>
        {subnotes.length > 0 ? (
          subnotes.map((subnote) => (
            <article className="ask-ai-note-summary" key={subnote.id}>
              <h3>{subnote.contentType}</h3>
              <p>{subnote.content}</p>
            </article>
          ))
        ) : (
          <p className="ask-ai-note-empty">
            {loadingSummary
              ? t('askAI.preview.loadingSummary')
              : t('askAI.preview.noSummary')}
          </p>
        )}
      </section>

      <section className="ask-ai-note-section">
        <h2>{t('askAI.preview.transcriptTitle')}</h2>
        {transcript ? (
          <p>{transcript}</p>
        ) : (
          <p className="ask-ai-note-empty">{t('askAI.preview.noTranscript')}</p>
        )}
      </section>
    </section>
  );
}
