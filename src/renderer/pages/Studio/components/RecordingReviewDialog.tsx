import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceSaveSelection } from '../../Recording/components/SaveToWorkspaceDialog';

type WorkspaceOption = { id: number; name: string };

type Props = {
  open: boolean;
  defaultNoteName: string;
  rawTranscript: string;
  summaries: string[];
  processing: boolean;
  saving: boolean;
  error: string | null;
  onSave(selection: WorkspaceSaveSelection): Promise<void>;
  onRerecord(): void;
  onClose(): void;
};

const NEW_WORKSPACE_VALUE = '__new__';

/**
 * 录音结束后的复核弹窗：并排展示「整理文本（语义总结）」与「原始转录」，
 * 底部可保存为工作区笔记或重新录制。保存成功由父级负责把笔记挂到对话上。
 */
export default function RecordingReviewDialog({
  open,
  defaultNoteName,
  rawTranscript,
  summaries,
  processing,
  saving,
  error,
  onSave,
  onRerecord,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceValue, setWorkspaceValue] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [noteName, setNoteName] = useState(defaultNoteName);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setNoteName(defaultNoteName);
    setNewWorkspaceName('');
    setLoadError(null);
    setLoading(true);

    window.electron.workspace
      .getList(100)
      .then((items) => {
        if (cancelled) return null;
        const options = (items as WorkspaceOption[]).filter(
          (item) => Number.isInteger(item.id) && item.id > 0 && item.name,
        );
        setWorkspaces(options);
        setWorkspaceValue(
          options.length > 0 ? String(options[0].id) : NEW_WORKSPACE_VALUE,
        );
        return null;
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setWorkspaces([]);
        setWorkspaceValue(NEW_WORKSPACE_VALUE);
        setLoadError(
          reason instanceof Error
            ? reason.message
            : t('studio.review.error.loadWorkspaces'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [defaultNoteName, open, t]);

  const selectedWorkspaceId = useMemo(() => {
    if (workspaceValue === NEW_WORKSPACE_VALUE) return null;
    const id = Number(workspaceValue);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [workspaceValue]);

  if (!open) return null;

  const cleanedText = summaries.join('\n');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (saving || loading) return;
    onSave({
      workspaceId: selectedWorkspaceId,
      newWorkspaceName: newWorkspaceName.trim(),
      noteName: noteName.trim(),
    }).catch(() => undefined);
  };

  return (
    <div className="studio-review-modal" role="presentation">
      <form className="studio-review-dialog" onSubmit={submit}>
        <header>
          <div>
            <span>RECORDING</span>
            <h2>{t('studio.review.title')}</h2>
          </div>
          <button
            type="button"
            className="studio-review-dialog__close"
            disabled={saving || processing}
            onClick={onClose}
            aria-label={t('studio.review.close')}
          >
            ×
          </button>
        </header>

        {processing && (
          <div
            className="studio-review-processing"
            role="status"
            aria-live="polite"
          >
            <span
              className="studio-review-processing__spinner"
              aria-hidden="true"
            />
            <div>
              <strong>{t('studio.review.processing.title')}</strong>
              <span>{t('studio.review.processing.description')}</span>
            </div>
          </div>
        )}

        <div className="studio-review-texts">
          <section>
            <h3>{t('studio.review.summary')}</h3>
            <div className="studio-review-text">
              {cleanedText || (
                <span className="studio-review-empty">
                  {t('studio.review.summary.empty')}
                </span>
              )}
            </div>
          </section>
          <section>
            <h3>{t('studio.review.transcript')}</h3>
            <div className="studio-review-text">
              {rawTranscript || (
                <span className="studio-review-empty">
                  {t('studio.review.transcript.empty')}
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="studio-review-form">
          <label htmlFor="studio-review-workspace">
            <span>{t('studio.review.workspace')}</span>
            <select
              id="studio-review-workspace"
              value={workspaceValue}
              disabled={saving || loading}
              onChange={(event) => setWorkspaceValue(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
              <option value={NEW_WORKSPACE_VALUE}>
                {t('studio.review.workspace.new')}
              </option>
            </select>
          </label>

          {workspaceValue === NEW_WORKSPACE_VALUE && (
            <label htmlFor="studio-review-new-workspace">
              <span>{t('studio.review.workspace.name')}</span>
              <input
                id="studio-review-new-workspace"
                type="text"
                value={newWorkspaceName}
                disabled={saving}
                maxLength={80}
                placeholder={t('workspace.home.create.placeholder')}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
              />
            </label>
          )}

          <label htmlFor="studio-review-note-name">
            <span>{t('studio.review.noteTitle')}</span>
            <input
              id="studio-review-note-name"
              type="text"
              value={noteName}
              disabled={saving}
              maxLength={80}
              onChange={(event) => setNoteName(event.target.value)}
            />
          </label>
        </div>

        {(loadError || error) && (
          <p className="studio-review-dialog__error" role="alert">
            {error || loadError}
          </p>
        )}

        <footer>
          <button
            type="button"
            className="studio-review-dialog__secondary"
            disabled={saving || processing}
            onClick={onRerecord}
          >
            {t('studio.review.rerecord')}
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              processing ||
              loading ||
              !rawTranscript.trim() ||
              !noteName.trim() ||
              (workspaceValue === NEW_WORKSPACE_VALUE &&
                !newWorkspaceName.trim())
            }
          >
            {saving ? t('studio.review.saving') : t('studio.review.save')}
          </button>
        </footer>
      </form>
    </div>
  );
}
