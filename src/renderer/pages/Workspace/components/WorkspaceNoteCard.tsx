import { NoteItem, WorkspaceController } from '../WorkspaceController';
import { WorkspaceTemplate } from '../WorkspaceWorkflowController';
import KnowledgeOutputPanel from './KnowledgeOutputPanel';
import WorkspaceAudioPlayer from './WorkspaceAudioPlayer';

type Props = {
  workspaceId: number;
  note: NoteItem;
  templates: WorkspaceTemplate[];
  generating: boolean;
  isSelected?: boolean;
  onToggleSelection?: (noteId: number) => void;
  onGenerate(noteId: number, templateId: number): Promise<void>;
};

/** 协调笔记音视频、转录、派生内容，对应展示保留为独立组件。 */
export default function WorkspaceNoteCard({
  workspaceId,
  note,
  templates,
  generating,
  isSelected = false,
  onToggleSelection,
  onGenerate,
}: Props) {
  const handleExport = (format: 'word' | 'pdf') => {
    window.electron.export.note({
      title: note.name || '未命名笔记',
      transcript: note.transcript,
      subnotes: note.subnotes.map(s => ({ type: s.content_type, content: s.content })),
      format
    }).catch(console.error);
  };

  return (
    <article className={`workspace-detail-note ${isSelected ? 'selected' : ''}`} id={`workspace-note-${note.id}`}>
      <header className="workspace-note-head">
        {onToggleSelection && (
          <label className="workspace-note-pick">
            <input
              aria-label="选择这篇笔记"
              checked={isSelected}
              onChange={() => onToggleSelection(note.id)}
              type="checkbox"
            />
          </label>
        )}
        <div className="workspace-note-identity">
          {/* 「工作笔记」对每条都一样，等于没信息；只有置顶才值得占一行。
              is_pinned 来自 sqlite，是 0/1 而不是布尔值，用 && 会把 0 渲染出来。 */}
          {note.is_pinned ? (
            <span className="workspace-note-kind" title="置顶笔记">
              📌 置顶
            </span>
          ) : null}
          <h2>{note.name || '未命名笔记'}</h2>
        </div>
        <div className="workspace-note-tools">
          <button
            className="ws-btn ws-btn-quiet"
            onClick={() => handleExport('word')}
            title="导出为 Word 文档"
            type="button"
          >
            ⬇ Word
          </button>
          <button
            className="ws-btn ws-btn-quiet"
            onClick={() => handleExport('pdf')}
            title="导出为 PDF"
            type="button"
          >
            ⬇ PDF
          </button>
          <time dateTime={note.updated_at} title="最后更新">
            {WorkspaceController.formatDate(note.updated_at, 'short')}
          </time>
        </div>
      </header>

      {/* 录音只是一条附件，压成一行放在标题下面 */}
      <div className="workspace-note-audio">
        <span aria-hidden="true" className="ws-label" title="录音">
          🎙
        </span>
        <WorkspaceAudioPlayer workspaceId={workspaceId} note={note} />
      </div>

      <div className="workspace-content-grid">
        <section className="workspace-transcript-section">
          <h3>📝 转录</h3>
          <p className="workspace-transcript">
            {note.transcript || '暂无转录内容'}
          </p>
        </section>

        <section>
          <h3>🧩 子笔记</h3>
          {note.subnotes.length === 0 ? (
            <span className="workspace-content-empty">暂无</span>
          ) : (
            <div className="workspace-content-stack">
              {note.subnotes.map((subnote) => (
                <div className="workspace-content-item" key={subnote.id}>
                  <small>{subnote.content_type}</small>
                  <p>{subnote.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <KnowledgeOutputPanel
          generating={generating}
          note={note}
          onGenerate={onGenerate}
          templates={templates}
        />

        <section className="workspace-conversation-section">
          <h3>💬 AI 对话</h3>
          {note.conversations.length === 0 ? (
            <span className="workspace-content-empty">暂无</span>
          ) : (
            <div className="workspace-content-stack">
              {note.conversations.map((conversation) => (
                <details
                  className="workspace-conversation"
                  key={conversation.id}
                >
                  <summary>
                    {conversation.name}
                    <span className="workspace-conversation-count">
                      💬 {conversation.messages.length}
                    </span>
                  </summary>
                  <div>
                    {conversation.messages.map((message) => (
                      <p key={message.id}>
                        <strong>{message.role}</strong>
                        {message.content}
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
