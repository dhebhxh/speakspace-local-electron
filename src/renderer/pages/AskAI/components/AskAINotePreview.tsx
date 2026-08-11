import { AskAINote, formatAskAIDate } from '../AskAITypes';

type AskAINotePreviewProps = {
  note: AskAINote | null;
};

export default function AskAINotePreview({ note }: AskAINotePreviewProps) {
  if (!note) {
    return (
      <section className="ask-ai-note-preview ask-ai-empty">
        <strong>请选择一条笔记</strong>
        <span>笔记原文将在这里显示。</span>
      </section>
    );
  }

  return (
    <section className="ask-ai-note-preview">
      <header>
        <div>
          <span>当前笔记</span>
          <h1>{note.name}</h1>
        </div>
        <time>{formatAskAIDate(note.updatedAt)}</time>
      </header>
      <p>{note.transcript || note.transcriptPreview}</p>
    </section>
  );
}
