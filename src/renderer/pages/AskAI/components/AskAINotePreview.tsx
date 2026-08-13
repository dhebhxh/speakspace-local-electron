import { useTranslation } from 'react-i18next';
import { AskAINote, formatAskAIDate } from '../AskAITypes';

type AskAINotePreviewProps = {
  note: AskAINote | null;
};

export default function AskAINotePreview({ note }: AskAINotePreviewProps) {
  const { t } = useTranslation();

  if (!note) {
    return (
      <section className="ask-ai-note-preview ask-ai-empty">
        <strong>{t('studio.preview.empty.title')}</strong>
        <span>{t('studio.preview.empty.description')}</span>
      </section>
    );
  }

  return (
    <section className="ask-ai-note-preview">
      <header>
        <div>
          <span>{t('studio.chat.scope.note')}</span>
          <h1>{note.name}</h1>
        </div>
        <time>{formatAskAIDate(note.updatedAt)}</time>
      </header>
      <p>{note.transcript || note.transcriptPreview}</p>
    </section>
  );
}
