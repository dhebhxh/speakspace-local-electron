import { FormEvent, useState } from 'react';

type AskAICreateNoteDialogProps = {
  onClose: () => void;
  onCreate: (name: string, transcript: string) => Promise<boolean>;
};

export default function AskAICreateNoteDialog({
  onClose,
  onCreate,
}: AskAICreateNoteDialogProps) {
  const [name, setName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transcript.trim() || isSaving) return;

    setIsSaving(true);
    const created = await onCreate(name.trim(), transcript.trim());
    setIsSaving(false);
    if (created) onClose();
  }

  return (
    <div className="ask-ai-dialog-backdrop" role="presentation">
      <form className="ask-ai-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>笔记库</span>
            <h2>新增笔记</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <label htmlFor="ask-ai-note-name">
          标题
          <input
            id="ask-ai-note-name"
            value={name}
            placeholder="例如：项目会议"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label htmlFor="ask-ai-note-transcript">
          笔记内容
          <textarea
            id="ask-ai-note-transcript"
            value={transcript}
            placeholder="粘贴或输入要供本地模型参考的文字…"
            onChange={(event) => setTranscript(event.target.value)}
          />
        </label>

        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!transcript.trim() || isSaving}>
            {isSaving ? '保存中…' : '保存笔记'}
          </button>
        </footer>
      </form>
    </div>
  );
}
