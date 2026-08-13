import { useEffect, useState } from 'react';
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
        <strong>请选择一条笔记</strong>
        <span>笔记原文将在这里显示。</span>
      </section>
    );
  }

  const transcript = note.transcript || note.transcriptPreview;

  return (
    <section className="ask-ai-note-preview">
      <header>
        <div>
          <span>当前笔记</span>
          <h1>{note.name}</h1>
        </div>
        <time>{formatAskAIDate(note.updatedAt)}</time>
      </header>

      <section className="ask-ai-note-section">
        <h2>摘要</h2>
        {subnotes.length > 0 ? (
          subnotes.map((subnote) => (
            <article className="ask-ai-note-summary" key={subnote.id}>
              <h3>{subnote.contentType}</h3>
              <p>{subnote.content}</p>
            </article>
          ))
        ) : (
          <p className="ask-ai-note-empty">
            {loadingSummary ? '正在读取摘要…' : '这条笔记还没有摘要。'}
          </p>
        )}
      </section>

      <section className="ask-ai-note-section">
        <h2>原文转录</h2>
        {transcript ? (
          <p>{transcript}</p>
        ) : (
          <p className="ask-ai-note-empty">这条笔记没有转录内容。</p>
        )}
      </section>
    </section>
  );
}
