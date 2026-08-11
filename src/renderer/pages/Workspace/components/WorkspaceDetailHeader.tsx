import { Link } from 'react-router-dom';
import { WorkspaceController, WorkspaceItem } from '../WorkspaceController';

type Props = {
  workspace: WorkspaceItem;
  onRename(): Promise<void>;
  onDelete(): Promise<void>;
};

export default function WorkspaceDetailHeader({
  workspace,
  onRename,
  onDelete,
}: Props) {
  return (
    <>
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
          <button onClick={onRename} type="button">
            重命名
          </button>
          <button
            className="workspace-delete-button"
            onClick={onDelete}
            type="button"
          >
            删除
          </button>
        </div>
      </header>
    </>
  );
}
