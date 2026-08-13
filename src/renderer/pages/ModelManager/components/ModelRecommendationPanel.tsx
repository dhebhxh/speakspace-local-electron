import { ModelRecommendation } from '../ModelRecommendationController';
import './ModelRecommendationPanel.css';

type ModelRecommendationPanelProps = {
  recommendation: ModelRecommendation | null;
  loading: boolean;
  error: string;
};

export default function ModelRecommendationPanel({
  recommendation,
  loading,
  error,
}: ModelRecommendationPanelProps) {
  const locateModel = (modelId: string) => {
    document.getElementById(`model-card-${modelId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  if (loading) {
    return (
      <div className="model-recommendation-status" role="status">
        <span className="model-recommendation-spinner" aria-hidden="true" />
        正在分析本机配置
      </div>
    );
  }
  if (error || !recommendation) {
    return (
      <p className="model-recommendation-status is-error">
        {error || '暂时无法生成模型建议'}
      </p>
    );
  }

  const { profile } = recommendation;
  return (
    <section className="model-recommendation" aria-label="本机模型推荐">
      <div className="model-recommendation-profile">
        <span className="model-recommendation-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" />
            <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
          </svg>
        </span>
        <div>
          <strong>根据本机推荐</strong>
          <span>
            {profile.logicalCores}C · {profile.totalMemoryGb}GB
            {profile.gpuName ? ' · GPU' : ''}
          </span>
        </div>
      </div>

      <div className="model-recommendation-list">
        {recommendation.stt && (
          <button
            onClick={() => locateModel(recommendation.stt?.id || '')}
            title={recommendation.stt.reason}
            type="button"
          >
            <span>转写</span>
            <strong>{recommendation.stt.name}</strong>
            <i aria-hidden="true">→</i>
          </button>
        )}
        {recommendation.llm && (
          <button
            onClick={() => locateModel(recommendation.llm?.id || '')}
            title={recommendation.llm.reason}
            type="button"
          >
            <span>问答</span>
            <strong>{recommendation.llm.name}</strong>
            <i aria-hidden="true">→</i>
          </button>
        )}
      </div>
    </section>
  );
}
