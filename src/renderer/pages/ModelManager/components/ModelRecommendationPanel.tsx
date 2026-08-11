import { ModelRecommendation } from '../ModelRecommendationController';
import './ModelRecommendationPanel.css';

type ModelRecommendationPanelProps = {
  recommendation: ModelRecommendation | null;
  loading: boolean;
  error: string;
};

/** 系统推荐摘要；按钮只定位模型，不会自动下载或启用。 */
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
    return <p className="model-recommendation-status">正在检测本机配置…</p>;
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
    <section
      className="model-recommendation"
      aria-labelledby="model-advisor-title"
    >
      <div className="model-recommendation-profile">
        <span className="model-recommendation-icon" aria-hidden="true">
          ✦
        </span>
        <div>
          <span>本机智能检测 · {profile.level}配置</span>
          <h2 id="model-advisor-title">推荐从这两个模型开始</h2>
          <p>
            {profile.logicalCores} 线程 · {profile.totalMemoryGb} GB 内存
            {profile.gpuName ? ` · ${profile.gpuName}` : ''}
          </p>
        </div>
      </div>

      <div className="model-recommendation-list">
        {recommendation.stt && (
          <button
            onClick={() => locateModel(recommendation.stt?.id || '')}
            type="button"
          >
            <span>推荐转录</span>
            <strong>{recommendation.stt.name}</strong>
            <small>{recommendation.stt.reason}</small>
            <i aria-hidden="true">定位模型 ↓</i>
          </button>
        )}
        {recommendation.llm && (
          <button
            onClick={() => locateModel(recommendation.llm?.id || '')}
            type="button"
          >
            <span>推荐语言模型</span>
            <strong>{recommendation.llm.name}</strong>
            <small>{recommendation.llm.reason}</small>
            <i aria-hidden="true">定位模型 ↓</i>
          </button>
        )}
      </div>
      <p className="model-recommendation-note">
        推荐依据仅为当前硬件余量；下载和启用仍由你确认。
      </p>
    </section>
  );
}
