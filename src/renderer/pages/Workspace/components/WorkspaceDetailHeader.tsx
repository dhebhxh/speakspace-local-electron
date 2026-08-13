import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();

  return (
    <>
      <Link className="workspace-back-link" to="/">
        ← {t('workspace.detail.back')}
      </Link>
      <header className="workspace-detail-hero">
        <div>
          <span className="workspace-detail-eyebrow">WORKSPACE DETAIL</span>
          <h1>{workspace.name}</h1>
          <div className="workspace-detail-meta">
            <span>
              {t('workspace.detail.meta.notes', {
                count: workspace.note_count,
              })}
            </span>
            <span>
              {t('workspace.detail.meta.pinned', {
                count: workspace.pinned_count,
              })}
            </span>
            <span>
              {t('workspace.detail.meta.opened')}{' '}
              {WorkspaceController.formatDate(
                workspace.recent_at,
                'long',
                i18n.resolvedLanguage,
              )}
            </span>
            <span>
              {t('workspace.detail.meta.updated')}{' '}
              {WorkspaceController.formatDate(
                workspace.updated_at,
                'long',
                i18n.resolvedLanguage,
              )}
            </span>
          </div>
        </div>
        <div className="workspace-detail-actions">
          <button onClick={onRename} type="button">
            {t('workspace.detail.rename')}
          </button>
          <button
            className="workspace-delete-button"
            onClick={onDelete}
            type="button"
          >
            {t('workspace.detail.delete')}
          </button>
        </div>
      </header>
    </>
  );
}
