import { NoteItem, WorkspaceController } from '../WorkspaceController';
import { WorkspaceTemplate } from '../WorkspaceWorkflowController';
import KnowledgeOutputPanel from './KnowledgeOutputPanel';
import WorkspaceAudioPlayer from './WorkspaceAudioPlayer';

type Props = {
  workspaceId: number;
  note: NoteItem;
  templates: WorkspaceTemplate[];
  generating: boolean;
  onGenerate(noteId: number, templateId: number): Promise<void>;
};

/** 单篇笔记的录音、转录、派生内容与对话展示保持在独立组件内。 */
export default function WorkspaceNoteCard({
  workspaceId,
  note,
  templates,
  generating,
  onGenerate,
}: Props) {
  return (
    <article className="workspace-detail-note">
      <header>
        <div>
          <span className="workspace-note-kind">
            {note.is_pinned ? '置顶笔记' : '工作笔记'}
          </span>
          <h2>{note.name || '未命名笔记'}</h2>
        </div>
        <time dateTime={note.updated_at}>
          {WorkspaceController.formatDate(note.updated_at, 'short')}
        </time>
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
