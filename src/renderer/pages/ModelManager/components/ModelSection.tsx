import { ModelCard } from './ModelCard';
import { Model } from '../../../../main/AI-module/Model';
import './ModelSection.css';

// Keep the named export for existing callers.
// eslint-disable-next-line import/prefer-default-export
export function ModelSection({
  title,
  models,
  onRefresh,
  modelType,
  recommendedModelId,
}: {
  title: string;
  models: Model[];
  onRefresh: () => Promise<void>;
  modelType: string;
  recommendedModelId: string | undefined;
}) {
  const activeModel = models.find((model) => model.activated);
  const downloadedCount = models.filter((model) => model.downloaded).length;

  return (
    <section className="model-section">
      <header className="model-section-header">
        <div className="model-section-title">
          <span className="model-section-icon" aria-hidden="true">
            {modelType === 'stt' ? (
              <svg viewBox="0 0 24 24">
                <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 10v4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M5 6h14v10H9l-4 3V6Z" />
                <path d="M8 10h8M8 13h5" />
              </svg>
            )}
          </span>
          <div>
            <h3>{title}</h3>
            <span title={activeModel?.name}>
              {activeModel ? activeModel.name : '尚未选择'}
            </span>
          </div>
        </div>
        <div className="model-section-counts">
          <span>{downloadedCount} 已下载</span>
          <strong>{models.length}</strong>
        </div>
      </header>

      {models.length === 0 ? (
        <p className="model-section-empty">暂无可用模型</p>
      ) : (
        <div
          aria-label={`${title}模型列表`}
          className="model-card-list"
          role="region"
        >
          <div className="model-card-grid">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onRefresh={onRefresh}
                modelType={modelType}
                recommended={model.id === recommendedModelId}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
