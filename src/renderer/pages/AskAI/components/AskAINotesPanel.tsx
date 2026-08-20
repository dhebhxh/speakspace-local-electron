import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AskAIConversation, AskAINote, formatAskAIDate } from '../AskAITypes';
import { setNoteDragPayload } from '../AskAIDragPayload';
import useLibrarySplit from '../useLibrarySplit';
import TrashCanButton from '../../../components/TrashCanButton';

/**
 * 分隔条可以把「最近会话」拉高，原来固定只渲染 6 条会让多出来的空间是空的；
 * 这里放宽上限，同时避免会话很多时无限渲染。
 */
const RECENT_CONVERSATION_LIMIT = 50;

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
  /** 点击笔记打开右侧的预览；未提供则双击无效果 */
  onPreviewNote?: (noteId: number) => void;
  onOpenConversation: (conversationId: number) => void;
  onDeleteNote: (noteId: number) => void;
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
  onDeleteNote,
}: AskAINotesPanelProps) {
  const { t } = useTranslation();
  const split = useLibrarySplit();
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
    return (
      [...buckets.entries()]
        .map(([workspaceId, items]) => ({
          workspaceId,
          name:
            workspaceId === null
              ? t('askAI.notesPanel.unclassified')
              : (nameById.get(workspaceId) ??
                `${t('askAI.notesPanel.workspacePrefix')}${workspaceId}`),
          items,
        }))
        // 未分类且为空时不必占一行。
        .filter((group) => group.workspaceId !== null || group.items.length > 0)
    );
  }, [notes, t, workspaces]);

  const renderNote = (note: AskAINote) => (
    <div
      key={note.id}
      className={`ask-ai-note-card${
        selectedNoteId === note.id ? ' active' : ''
      }`}
      title={t('askAI.notesPanel.noteHint')}
      draggable
      onDragStart={(event) =>
        setNoteDragPayload(
          event.dataTransfer,
          { kind: 'note', id: note.id },
          note.name,
        )
      }
    >
      <button
        className="btn-plain ask-ai-note-main"
        onClick={() => onSelectNote(note.id)}
        onDoubleClick={() => onPreviewNote?.(note.id)}
        type="button"
      >
        <strong>{note.name}</strong>
        <span>
          {note.transcriptPreview || t('askAI.notesPanel.noSummaryShort')}
        </span>
        <time>{formatAskAIDate(note.updatedAt)}</time>
      </button>
      <TrashCanButton
        className="ask-ai-note-delete"
        label={t('trash.action.moveNote')}
        onClick={(event) => {
          event.stopPropagation();
          onDeleteNote(note.id);
        }}
      />
    </div>
  );

  return (
    <aside className="ask-ai-library" ref={split.containerRef}>
      <header className="ask-ai-library-header">
        <div>
          <span>Ask AI</span>
          <h2>{t('askAI.createNote.library')}</h2>
        </div>
        {/* 有工作区分组时，新增按钮移到每个工作区那一行（悬停显示） */}
        {!workspaces && (
          <button
            type="button"
            onClick={() => onAddNote()}
            aria-label="新增笔记"
          >
            ＋
          </button>
        )}
      </header>

      <div className="ask-ai-note-list" ref={split.noteListRef}>
        {notes.length === 0 && !workspaces ? (
          <div className="ask-ai-empty">
            <strong>{t('askAI.notesPanel.noNotesTitle')}</strong>
            <span>{t('askAI.notesPanel.noNotesDesc')}</span>
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
                      title={`${t('askAI.notesPanel.dragWorkspaceHintPrefix')}${group.name}${t('askAI.notesPanel.dragWorkspaceHintSuffix')}`}
                      onDragStart={(event) =>
                        setNoteDragPayload(
                          event.dataTransfer,
                          {
                            kind: 'workspace',
                            id: group.workspaceId as number,
                          },
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
                      aria-label={`${t('askAI.notesPanel.addNoteInWorkspacePrefix')}${group.name}${t('askAI.notesPanel.addNoteInWorkspaceSuffix')}`}
                      title={`${t('askAI.notesPanel.addNoteInWorkspacePrefix')}${group.name}${t('askAI.notesPanel.addNoteInWorkspaceSuffix')}`}
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
        <>
          {/* 这条线本身就是分隔条：按住上下拖，或聚焦后按上下方向键 */}
          <div
            className={`ask-ai-library-splitter${
              split.dragging ? ' is-dragging' : ''
            }`}
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('askAI.notesPanel.resizeHandle')}
            title={t('askAI.notesPanel.resizeHandle')}
            tabIndex={0}
            {...split.splitterHandlers}
          />
          <section
            className="ask-ai-recents"
            ref={split.recentsRef}
            style={
              split.height === null
                ? undefined
                : { flex: `0 0 ${split.height}px`, maxHeight: 'none' }
            }
          >
            {/* 标题与 ＋ 放在同一个容器里，布局与上面的工作区分组一致 */}
            <h3 className="ask-ai-recents-header">
              <span>{t('askAI.notesPanel.recentConversations')}</span>
              {onNewConversation && (
                <button
                  type="button"
                  className="ask-ai-group-add"
                  onClick={onNewConversation}
                  aria-label={t('askAI.notesPanel.newConversation')}
                  title={t('askAI.notesPanel.newConversation')}
                >
                  ＋
                </button>
              )}
            </h3>
            <div className="ask-ai-recents-list">
              {conversations
                .slice(0, RECENT_CONVERSATION_LIMIT)
                .map((conversation) => (
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
        </>
      )}
    </aside>
  );
}
