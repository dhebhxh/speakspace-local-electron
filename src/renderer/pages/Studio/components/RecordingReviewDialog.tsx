import { FormEvent, useEffect, useMemo, useState } from 'react';
import { WorkspaceSaveSelection } from '../../Recording/components/SaveToWorkspaceDialog';

type WorkspaceOption = { id: number; name: string };

type Props = {
  open: boolean;
  defaultNoteName: string;
  rawTranscript: string;
  summaries: string[];
  /** 转录/语义整理是否仍在后台进行（弹窗先开，内容随后填充）。 */
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
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceValue, setWorkspaceValue] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [noteName, setNoteName] = useState(defaultNoteName);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 用户是否手动改过标题：改过之后就不再被自动生成的标题覆盖。
  const [titleDirty, setTitleDirty] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setNewWorkspaceName('');
    setTitleDirty(false);
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
            : '无法读取工作空间 / Unable to load workspaces',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // 标题随外部默认值更新（如稍后生成的 AI 标题），但不覆盖用户已手动输入的内容。
  useEffect(() => {
    if (!open || titleDirty) return;
    setNoteName(defaultNoteName);
  }, [open, defaultNoteName, titleDirty]);

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
            <h2>录音完成 · 请确认</h2>
            {processing && (
              <p className="studio-review-progress">
                <span className="studio-review-spinner" aria-hidden="true" />
                正在整理…
              </p>
            )}
          </div>
          <button
            type="button"
            className="studio-review-dialog__close"
            disabled={saving}
            onClick={onClose}
            aria-label="关闭 / Close"
          >
            ×
          </button>
        </header>

        <div className="studio-review-texts">
          <section>
            <h3>整理文本 / Summary</h3>
            <div className="studio-review-text">
              {cleanedText || (
                <span className="studio-review-empty">
                  {processing
                    ? '正在生成…'
                    : '本次录音未生成语义总结（内容较短或未启用 AI 模型）。'}
                </span>
              )}
            </div>
          </section>
          <section>
            <h3>原始转录 / Transcript</h3>
            <div className="studio-review-text">
              {rawTranscript || (
                <span className="studio-review-empty">
                  {processing ? '正在转录…' : '没有识别到文字。'}
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="studio-review-form">
          <label htmlFor="studio-review-workspace">
            <span>工作空间</span>
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
              <option value={NEW_WORKSPACE_VALUE}>+ 新建工作空间</option>
            </select>
          </label>

          {/* 选了「新建」才出现，直接用占位符提示，不再重复一行标签。 */}
          {workspaceValue === NEW_WORKSPACE_VALUE && (
            <input
              id="studio-review-new-workspace"
              type="text"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={newWorkspaceName}
              disabled={saving}
              maxLength={80}
              placeholder="新工作空间名称"
              aria-label="新工作空间名称"
              onChange={(event) => setNewWorkspaceName(event.target.value)}
            />
          )}

          <label htmlFor="studio-review-note-name">
            <span>笔记标题</span>
            <input
              id="studio-review-note-name"
              type="text"
              value={noteName}
              disabled={saving}
              maxLength={80}
              onChange={(event) => {
                setTitleDirty(true);
                setNoteName(event.target.value);
              }}
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
            disabled={saving}
            onClick={onRerecord}
          >
            重新录制 / Re-record
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              loading ||
              !rawTranscript.trim() ||
              !noteName.trim() ||
              (workspaceValue === NEW_WORKSPACE_VALUE &&
                !newWorkspaceName.trim())
            }
          >
            {saving ? '正在保存…' : '保存为笔记并对话'}
          </button>
        </footer>
      </form>
    </div>
  );
}
