import { useMemo } from 'react';
import { AskAIConversation, AskAINote, formatAskAIDate } from '../AskAITypes';
import { setNoteDragPayload } from '../AskAIDragPayload';

type AskAINotesPanelProps = {
  notes: AskAINote[];
  /** 提供后，笔记按所属工作区分组显示。 */
  workspaces?: { id: number; name: string }[];
  conversations: AskAIConversation[];
  selectedNoteId: number | null;
  /** 传入工作区 id 表示在该工作区下新增笔记。 */
  onAddNote: (workspaceId?: number | null) => void;
  /** 提供后，「最近会话」旁出现新建会话按钮。 */
  onNewConversation?: () => void;
  onSelectNote: (noteId: number) => void;
  /** 双击笔记时打开右侧原文预览；未提供则不响应双击。 */
  onPreviewNote?: (noteId: number) => void;
  onOpenConversation: (conversationId: number) => void;
};

export default function AskAINotesPanel({
  notes,
  workspaces,
  conversations,
  selectedNoteId,
  onAddNote,
  onNewConversation,
  onSelectNote,
  onPreviewNote,
  onOpenConversation,
}: AskAINotesPanelProps) {
  // 按工作区分组，保持笔记原有顺序；未归属工作区的归到「未分类」。
  // 空工作区也会列出来，方便直接在它下面新增笔记。
  const groups = useMemo(() => {
    const buckets = new Map<number | null, AskAINote[]>();
    workspaces?.forEach((item) => buckets.set(item.id, []));
    notes.forEach((note) => {
      const key = note.workspaceId ?? null;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(note);
      else buckets.set(key, [note]);
    });

    const nameById = new Map(workspaces?.map((item) => [item.id, item.name]));
    return [...buckets.entries()]
      .map(([workspaceId, items]) => ({
        workspaceId,
        name:
          workspaceId === null
            ? '未分类'
            : nameById.get(workspaceId) ?? `工作区 ${workspaceId}`,
        items,
      }))
      // 未分类且为空时不必占一行。
      .filter((group) => group.workspaceId !== null || group.items.length > 0);
  }, [notes, workspaces]);

  const renderNote = (note: AskAINote) => (
    <button
      type="button"
      key={note.id}
      className={selectedNoteId === note.id ? 'active' : ''}
      title="双击查看原文，拖到输入框可关联"
      draggable
      onDragStart={(event) =>
        setNoteDragPayload(
          event.dataTransfer,
          { kind: 'note', id: note.id },
          note.name,
        )
      }
      onClick={() => onSelectNote(note.id)}
      onDoubleClick={() => onPreviewNote?.(note.id)}
    >
      <strong>{note.name}</strong>
      <span>{note.transcriptPreview || '暂无摘要'}</span>
      <time>{formatAskAIDate(note.updatedAt)}</time>
    </button>
  );

  return (
    <aside className="ask-ai-library">
      <header className="ask-ai-library-header">
        <div>
          <span>Ask AI</span>
          <h2>笔记库</h2>
        </div>
        {/* 有工作区分组时，新增按钮移到每个工作区那一行（悬停显示） */}
        {!workspaces && (
          <button type="button" onClick={() => onAddNote()} aria-label="新增笔记">
            ＋
          </button>
        )}
      </header>

      <div className="ask-ai-note-list">
        {notes.length === 0 && !workspaces ? (
          <div className="ask-ai-empty">
            <strong>还没有笔记</strong>
            <span>新增一条笔记后即可向本地模型提问。</span>
          </div>
        ) : (
          groups.map((group) =>
            workspaces ? (
              <section
                className="ask-ai-note-group"
                key={group.workspaceId ?? 'none'}
              >
                <h3>
                  {group.workspaceId === null ? (
                    <span>{group.name}</span>
                  ) : (
                    // 整个工作区可以直接拖到输入框，表示读取它下面的全部笔记。
                    <span
                      className="ask-ai-group-name"
                      draggable
                      title={`拖到输入框可关联「${group.name}」全部笔记`}
                      onDragStart={(event) =>
                        setNoteDragPayload(
                          event.dataTransfer,
                          { kind: 'workspace', id: group.workspaceId as number },
                          group.name,
                        )
                      }
                    >
                      {group.name}
                    </span>
                  )}
                  {group.workspaceId !== null && (
                    <button
                      type="button"
                      className="ask-ai-group-add"
                      onClick={() => onAddNote(group.workspaceId)}
                      aria-label={`在「${group.name}」新增笔记`}
                      title={`在「${group.name}」新增笔记`}
                    >
                      ＋
                    </button>
                  )}
                </h3>
                {group.items.map(renderNote)}
              </section>
            ) : (
              group.items.map(renderNote)
            ),
          )
        )}
      </div>

      {(conversations.length > 0 || onNewConversation) && (
        <section className="ask-ai-recents">
          {/* 标题与 ＋ 放在同一个容器里，布局与上面的工作区分组一致 */}
          <h3 className="ask-ai-recents-header">
            <span>最近会话</span>
            {onNewConversation && (
              <button
                type="button"
                className="ask-ai-group-add"
                onClick={onNewConversation}
                aria-label="新建会话"
                title="新建会话"
              >
                ＋
              </button>
            )}
          </h3>
          <div className="ask-ai-recents-list">
            {conversations.slice(0, 6).map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => onOpenConversation(conversation.id)}
              >
                <strong>{conversation.name}</strong>
                <time>{formatAskAIDate(conversation.updatedAt)}</time>
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
