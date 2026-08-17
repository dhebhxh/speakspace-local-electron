import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit3, Trash2, FileText, Pin, Clock, Activity } from 'lucide-react';
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
  const { t, i18n } = useTranslation();
  return (
    <>
      <Link className="workspace-back-link" to="/">
        <ArrowLeft size={16} style={{ marginRight: 8 }} />
        {t('workspace.detail.backBtn')}
      </Link>
      <header className="workspace-detail-head">
        <div className="workspace-detail-identity">
          <h1>{workspace.name}</h1>
          <p className="workspace-detail-meta">
            <span title={t('workspace.detail.notesLabel')}>
              <FileText size={14} style={{ marginRight: 4 }} /> {workspace.note_count}
            </span>
            <span title={t('workspace.detail.pinnedLabel')}>
              <Pin size={14} style={{ marginRight: 4 }} /> {workspace.pinned_count}
            </span>
            <span title={t('workspace.detail.lastOpened')}>
              <Clock size={14} style={{ marginRight: 4 }} /> {WorkspaceController.formatDate(workspace.recent_at, 'short', i18n.language)}
            </span>
            <span title={t('workspace.detail.updated')}>
              <Activity size={14} style={{ marginRight: 4 }} /> {WorkspaceController.formatDate(workspace.updated_at, 'short', i18n.language)}
            </span>
          </p>
        </div>
        <div className="workspace-detail-actions">
          <button
            aria-label="Rename"
            className="ws-btn ws-btn-icon"
            onClick={onRename}
            title="Rename"
            type="button"
          >
            <Edit3 size={18} />
          </button>
          <button
            aria-label={t('workspace.detail.deleteWorkspace')}
            className="ws-btn ws-btn-icon ws-btn-danger"
            onClick={onDelete}
            title={t('workspace.detail.deleteWorkspace')}
            type="button"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>
    </>
  );
}
