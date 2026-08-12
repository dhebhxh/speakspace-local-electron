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
      <header style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onToggleSelection && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => onToggleSelection(note.id)}
              style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
            />
          )}
          <div>
            <span className="workspace-note-kind">
              {note.is_pinned ? '置顶笔记' : '工作笔记'}
            </span>
            <h2>{note.name || '未命名笔记'}</h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn-secondary btn-sm" onClick={() => handleExport('word')}>
            匯出 Word
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
            匯出 PDF
          </button>
          <time dateTime={note.updated_at} style={{ marginLeft: '8px' }}>
            {WorkspaceController.formatDate(note.updated_at, 'short')}
          </time>
        </div>
      </header>

      <div className="workspace-content-grid">
        <section>
          <h3>录音</h3>
          <WorkspaceAudioPlayer workspaceId={workspaceId} note={note} />
        </section>

        <section className="workspace-transcript-section">
          <h3>完整转录</h3>
          <p className="workspace-transcript">
            {note.transcript || '暂无转录内容'}
          </p>
        </section>

        <section>
          <h3>子笔记</h3>
          {note.subnotes.length === 0 ? (
            <span className="workspace-content-empty">暂无子笔记</span>
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
          <h3>关联 AI 对话</h3>
          {note.conversations.length === 0 ? (
            <span className="workspace-content-empty">暂无关联对话</span>
          ) : (
            <div className="workspace-content-stack">
              {note.conversations.map((conversation) => (
                <details
                  className="workspace-conversation"
                  key={conversation.id}
                >
                  <summary>
                    {conversation.name} · {conversation.messages.length} 条消息
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
