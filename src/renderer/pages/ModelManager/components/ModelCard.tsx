import { useState } from 'react';
import { Model } from '../../../../main/AI-module/Model';
import './ModelCard.css';
import './ModelCardActions.css';

function getModelProfile(model: Model, modelType: string): string {
  const identity = `${model.id} ${model.name}`.toLowerCase();
  if (identity.includes('parakeet')) return '英语会议';
  if (identity.includes('tiny') || identity.includes('phi')) return '极速';
  if (identity.includes('base')) return '轻量';
  if (identity.includes('small') || identity.includes('qwen')) return '均衡';
  if (identity.includes('medium') || identity.includes('large'))
    return '高精度';
  return modelType === 'stt' ? '本地转写' : '本地推理';
}

// Keep the named export for existing callers.
// eslint-disable-next-line import/prefer-default-export
export function ModelCard({
  model,
  onRefresh,
  modelType,
  recommended,
}: {
  model: Model;
  onRefresh: () => Promise<void>;
  modelType: string;
  recommended: boolean;
}) {
  const [pending, setPending] = useState<
    'download' | 'delete' | 'activate' | null
  >(null);
  const [error, setError] = useState('');

  async function runAction(
    action: 'download' | 'delete' | 'activate',
    operation: () => Promise<unknown>,
  ) {
    if (pending) return;
    try {
      setPending(action);
      setError('');
      await operation();
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '模型操作失败');
    } finally {
      setPending(null);
    }
  }

  const handleDownload = () =>
    runAction('download', () =>
      window.electron.modelManagement.downloadModel(modelType, model.id),
    );

  const handleDelete = () =>
    runAction('delete', () =>
      window.electron.modelManagement.deleteModel(modelType, model.id),
    );

  const handleActivate = () =>
    runAction('activate', () =>
      window.electron.modelManagement.activateModel(modelType, model.id),
    );

  let statusLabel = '未下载';
  if (model.downloaded) statusLabel = '已下载';
  if (model.activated) statusLabel = '使用中';
  let activateLabel = '设为当前';
  if (model.activated) activateLabel = '当前模型';
  if (pending === 'activate') activateLabel = '设置中';

  return (
    <article
      className={`model-card${recommended ? ' is-recommended' : ''}${
        model.activated ? ' is-active' : ''
      }`}
      id={`model-card-${model.id}`}
    >
      <header className="model-card-header">
        <span className="model-card-icon" aria-hidden="true">
          {modelType === 'stt' ? (
            <svg viewBox="0 0 24 24">
              <path d="M5 11v2M9 7v10M13 4v16M17 8v8M21 10v4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M7 8a5 5 0 0 1 9-2 4 4 0 0 1 1 7 5 5 0 0 1-9 3 4 4 0 0 1-1-8Z" />
              <path d="M9 10h6M9 13h4" />
            </svg>
          )}
        </span>
        <div className="model-card-title">
          <h4 title={model.name}>{model.name}</h4>
          <span
            className={`model-status${model.activated ? ' is-active' : ''}`}
          >
            {statusLabel}
          </span>
        </div>
        {recommended && <span className="model-recommended-badge">推荐</span>}
      </header>

      <div className="model-card-tags" aria-label="模型特征">
        <span className="is-profile">{getModelProfile(model, modelType)}</span>
        <span>{model.size}</span>
        <span>{model.language || '通用'}</span>
        <span title={model.engine}>{model.engine || '本地'}</span>
      </div>

      {error && (
        <p className="model-card-error" role="alert">
          {error}
        </p>
      )}

      <footer className="model-card-actions">
        {model.downloaded ? (
          <button
            className="model-action-button is-danger"
            disabled={pending !== null}
            onClick={handleDelete}
            type="button"
          >
            {pending === 'delete' ? '删除中' : '删除'}
          </button>
        ) : (
          <button
            className="model-action-button is-secondary"
            disabled={pending !== null}
            onClick={handleDownload}
            type="button"
          >
            {pending === 'download' ? '下载中' : '下载'}
          </button>
        )}

        <button
          className="model-action-button is-primary"
          disabled={!model.downloaded || model.activated || pending !== null}
          onClick={handleActivate}
          type="button"
        >
          {activateLabel}
        </button>
      </footer>
    </article>
  );
}
