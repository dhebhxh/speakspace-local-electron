import { Link } from 'react-router-dom';
import { WorkspaceController, WorkspaceItem } from '../WorkspaceController';

type Props = {
  workspace: WorkspaceItem;
  onRename(): Promise<void>;
  onDelete(): Promise<void>;
};

/**
 * 顶部只做一件事：说明当前在哪个工作空间，并提供重命名 / 删除。
 * 元信息用图标承载，完整含义放在 title 里，避免一行全是说明文字。
 */
export default function WorkspaceDetailHeader({
  workspace,
  onRename,
  onDelete,
}: Props) {
  return (
    <>
      <Link className="workspace-back-link" to="/">
        ← 返回
      </Link>
      <header className="workspace-detail-head">
        <div className="workspace-detail-identity">
          <h1>{workspace.name}</h1>
          <p className="workspace-detail-meta">
            <span title="笔记数">📄 {workspace.note_count}</span>
            <span title="置顶">📌 {workspace.pinned_count}</span>
            <span title="最近打开">
              🕘 {WorkspaceController.formatDate(workspace.recent_at, 'short')}
            </span>
            <span title="内容更新">
              ✏️ {WorkspaceController.formatDate(workspace.updated_at, 'short')}
            </span>
          </p>
        </div>
        <div className="workspace-detail-actions">
          <button
            aria-label="重命名"
            className="ws-btn ws-btn-icon"
            onClick={onRename}
            title="重命名"
            type="button"
          >
            ✏️
          </button>
          <button
            aria-label="删除工作空间"
            className="ws-btn ws-btn-icon ws-btn-danger"
            onClick={onDelete}
            title="删除工作空间"
            type="button"
          >
            🗑
          </button>
        </div>
      </header>
    </>
  );
}
