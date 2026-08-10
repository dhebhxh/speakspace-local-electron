import { useState } from 'react';
import { Model } from '../../../../main/AI-module/Model';
import { getModelDescription } from '../ModelDescription';
import './ModelCard.css';
import './ModelCardActions.css';

// 保留命名导出，避免扩大本次样式调整的调用范围。
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

  async function handleDownload() {
    await runAction('download', () =>
      window.electron.modelManagement.downloadModel(modelType, model.id),
    );
  }

  async function handleDelete() {
    await runAction('delete', () =>
      window.electron.modelManagement.deleteModel(modelType, model.id),
    );
  }

  async function handleActivate() {
    await runAction('activate', () =>
      window.electron.modelManagement.activateModel(modelType, model.id),
    );
  }

  let statusLabel = '未下载';
  if (model.downloaded) statusLabel = '已下载';
  if (model.activated) statusLabel = '当前使用';
  let activateLabel = '设为当前';
  if (model.activated) activateLabel = '当前使用';
  if (pending === 'activate') activateLabel = '设置中…';

  return (
    <article
      className={`model-card${recommended ? ' is-recommended' : ''}`}
      id={`model-card-${model.id}`}
    >
      <header className="model-card-header">
        <span className="model-card-icon" aria-hidden="true">
          {modelType === 'stt' ? 'ST' : 'LL'}
        </span>
        <div className="model-card-title">
          <h3>{model.name}</h3>
          <span
            className={`model-status${model.activated ? ' is-active' : ''}`}
          >
            {statusLabel}
          </span>
        </div>
        {recommended && <span className="model-recommended-badge">推荐</span>}
      </header>

      <p className="model-card-description">
        {getModelDescription(model, modelType)}
      </p>

      <dl className="model-card-details">
        <div>
          <dt>大小</dt>
          <dd>{model.size}</dd>
        </div>
        <div>
          <dt>语言</dt>
          <dd>{model.language || '通用'}</dd>
        </div>
        <div>
          <dt>引擎</dt>
          <dd>{model.engine || '—'}</dd>
        </div>
      </dl>

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
            {pending === 'delete' ? '删除中…' : '删除'}
          </button>
        ) : (
          <button
            className="model-action-button is-secondary"
            disabled={pending !== null}
            onClick={handleDownload}
            type="button"
          >
            {pending === 'download' ? '下载中…' : '下载'}
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
