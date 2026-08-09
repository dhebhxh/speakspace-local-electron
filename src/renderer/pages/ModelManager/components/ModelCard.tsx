import { Model } from '../../../../main/AI-module/Model';

// 保留命名导出，避免扩大本次样式调整的调用范围。
// eslint-disable-next-line import/prefer-default-export
export function ModelCard({
  model,
  onRefresh,
  modelType,
}: {
  model: Model;
  onRefresh: () => Promise<void>;
  modelType: string;
}) {
  async function handleDownload() {
    await window.electron.modelManagement.downloadModel(modelType, model.id);
    await onRefresh();
  }

  async function handleDelete() {
    await window.electron.modelManagement.deleteModel(modelType, model.id);
    await onRefresh();
  }

  async function handleActivate() {
    await window.electron.modelManagement.activateModel(modelType, model.id);
    await onRefresh();
  }

  let statusLabel = '未下载';
  if (model.downloaded) statusLabel = '已下载';
  if (model.activated) statusLabel = '当前使用';

  return (
    <article className="model-card">
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
      </header>

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

      <footer className="model-card-actions">
        {model.downloaded ? (
          <button
            className="model-action-button is-danger"
            onClick={handleDelete}
            type="button"
          >
            删除
          </button>
        ) : (
          <button
            className="model-action-button is-secondary"
            onClick={handleDownload}
            type="button"
          >
            下载
          </button>
        )}

        <button
          className="model-action-button is-primary"
          disabled={!model.downloaded || model.activated}
          onClick={handleActivate}
          type="button"
        >
          {model.activated ? '当前使用' : '设为当前'}
        </button>
      </footer>
    </article>
  );
}
