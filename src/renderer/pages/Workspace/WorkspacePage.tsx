import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  NoteItem,
  WorkspaceController,
  WorkspaceItem,
} from './WorkspaceController';
import './WorkspacePage.css';

const workspaceController = new WorkspaceController();

function WorkspaceAudioPlayer({
  workspaceId,
  note,
}: {
  workspaceId: number;
  note: NoteItem;
}) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  if (!note.audio_relative_path) {
    return <span className="workspace-content-empty">没有关联录音</span>;
  }

  const loadAudio = async () => {
    try {
      setLoading(true);
      setError('');
      const audio = await workspaceController.getNoteAudio(
        workspaceId,
        note.id,
      );
      if (!audio) {
        setError('录音文件不存在或已经移动');
        return;
      }

      const bytes = new Uint8Array(audio.bytes);
      const data = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      setAudioUrl(
        URL.createObjectURL(new Blob([data], { type: audio.mime_type })),
      );
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '读取录音失败'));
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <audio
        className="workspace-audio"
        controls
        preload="metadata"
        src={audioUrl}
      >
        <track kind="captions" />
      </audio>
    );
  }

  return (
    <div className="workspace-audio-loader">
      <button disabled={loading} onClick={loadAudio} type="button">
        {loading ? '读取中…' : '加载录音'}
      </button>
      <small>{error || note.audio_relative_path}</small>
    </div>
  );
}

/**
 * Workspace 详情页：进入时记录 last_opened_at，并展示该空间的完整内容。
 * updated_at 只用于说明内容或名称最后修改时间。
 */
export default function WorkspacePage() {
  const navigate = useNavigate();
  const { workspaceId: workspaceIdParam } = useParams();
  const workspaceId = Number(workspaceIdParam);
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setError('无效的工作空间 ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      // 先记录进入时间，再加载详情，保证返回首页时排序立即生效。
      const openedWorkspace =
        await workspaceController.openWorkspace(workspaceId);
      const workspaceNotes =
        await workspaceController.getWorkspaceNotes(workspaceId);
      setWorkspace(openedWorkspace);
      setNotes(workspaceNotes);
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '读取工作空间失败'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const renameWorkspace = async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    const nextName = window.prompt('输入新的工作空间名称', workspace.name);
    if (!nextName?.trim() || nextName.trim() === workspace.name) return;

    try {
      setError('');
      await workspaceController.renameWorkspace(workspace.id, nextName);
      setWorkspace(await workspaceController.openWorkspace(workspace.id));
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '重命名失败'));
    }
  };

  const deleteWorkspace = async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      `确定删除“${workspace.name}”及其中的全部笔记吗？`,
    );
    if (!confirmed) return;

    try {
      await workspaceController.deleteWorkspace(workspace.id);
      navigate('/');
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '删除失败'));
    }
  };

  const visibleNotes = WorkspaceController.filterNotes(notes, query);

  if (loading) {
    return <p className="workspace-detail-status">正在进入工作空间…</p>;
  }

  if (!workspace) {
    return (
      <section className="workspace-detail-page">
        <p className="workspace-detail-error" role="alert">
          {error || '工作空间不存在'}
        </p>
        <Link className="workspace-back-link" to="/">
          ← 返回最近使用
        </Link>
      </section>
    );
  }

  return (
    <section className="workspace-detail-page">
      <Link className="workspace-back-link" to="/">
        ← 返回最近使用
      </Link>

      <header className="workspace-detail-hero">
        <div>
          <span className="workspace-detail-eyebrow">WORKSPACE DETAIL</span>
          <h1>{workspace.name}</h1>
          <div className="workspace-detail-meta">
            <span>{workspace.note_count} 篇笔记</span>
            <span>{workspace.pinned_count} 篇置顶</span>
            <span>
              最近打开{' '}
              {WorkspaceController.formatDate(workspace.recent_at, 'long')}
            </span>
            <span>
              内容更新{' '}
              {WorkspaceController.formatDate(workspace.updated_at, 'long')}
            </span>
          </div>
        </div>
        <div className="workspace-detail-actions">
          <button onClick={renameWorkspace} type="button">
            重命名
          </button>
          <button
            className="workspace-delete-button"
            onClick={deleteWorkspace}
            type="button"
          >
            删除
          </button>
        </div>
      </header>

      {error && (
        <p className="workspace-detail-error" role="alert">
          {error}
        </p>
      )}

      <label className="workspace-detail-search" htmlFor="workspace-search">
        <span>搜索笔记、转录、子笔记或 AI 内容</span>
        <input
          id="workspace-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入标题或内容关键词"
          type="search"
          value={query}
        />
      </label>

      {visibleNotes.length === 0 && (
        <div className="workspace-detail-empty">
          <strong>{query ? '没有匹配内容' : '这个工作空间还没有笔记'}</strong>
          <span>{query ? '尝试更换搜索词。' : '完成录音后可归档到这里。'}</span>
        </div>
      )}

      <div className="workspace-detail-notes">
        {visibleNotes.map((note) => (
          <article className="workspace-detail-note" key={note.id}>
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
                <WorkspaceAudioPlayer workspaceId={workspace.id} note={note} />
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

              <section>
                <h3>AI 知识输出</h3>
                {note.knowledge_outputs.length === 0 ? (
                  <span className="workspace-content-empty">暂无 AI 输出</span>
                ) : (
                  <div className="workspace-content-stack">
                    {note.knowledge_outputs.map((output) => (
                      <div className="workspace-content-item" key={output.id}>
                        <small>
                          {output.template_name} · {output.content_type}
                        </small>
                        <p>{output.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

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
                          {conversation.name} · {conversation.messages.length}{' '}
                          条消息
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
        ))}
      </div>
    </section>
  );
}
