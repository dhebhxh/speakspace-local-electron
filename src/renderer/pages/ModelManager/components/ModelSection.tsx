import { ModelCard } from './ModelCard';
import { Model } from '../../../../main/AI-module/Model';
import './ModelSection.css';

// 保留命名导出，避免扩大本次样式调整的调用范围。
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
  const description =
    modelType === 'stt'
      ? '将录音转换为可搜索、可整理的文字。'
      : '用于总结、问答及其他 AI 内容处理。';

  return (
    <section className="model-section">
      <header className="model-section-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{models.length}</span>
      </header>

      {models.length === 0 ? (
        <p className="model-section-empty">暂无可用模型</p>
      ) : (
        <div
          aria-label={`${title} 模型列表`}
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
