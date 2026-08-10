import { useCallback, useEffect, useState } from 'react';
import { ModelSection } from './components/ModelSection';
import { STTModel } from '../../../main/AI-module/STTModel';
import { LLMModel } from '../../../main/AI-module/LLMModel';
import ModelRecommendationPanel from './components/ModelRecommendationPanel';
import WhisperRuntimePanel from './components/WhisperRuntimePanel';
import OllamaRuntimePanel from './components/OllamaRuntimePanel';
import TTSRuntimePanel from './components/TTSRuntimePanel';
import EmbeddingModelPanel from './components/EmbeddingModelPanel';
import {
  ModelRecommendation,
  ModelRecommendationController,
} from './ModelRecommendationController';
import './ModelManagerPage.css';

const recommendationController = new ModelRecommendationController();

// 保留命名导出，与现有路由导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export function ModelManagerPage() {
  const [sttModels, setSttModels] = useState<STTModel[]>([]);

  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [recommendation, setRecommendation] =
    useState<ModelRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [recommendationError, setRecommendationError] = useState('');

  useEffect(() => {
    async function loadModels() {
      const stt = await window.electron.modelManagement.getModelList('stt');
      const llm = await window.electron.modelManagement.getModelList('llm');

      setSttModels(stt);
      setLlmModels(llm);
      try {
        setRecommendation(
          await recommendationController.getRecommendation(stt, llm),
        );
      } catch (reason) {
        setRecommendationError(
          reason instanceof Error ? reason.message : '本机配置检测失败',
        );
      } finally {
        setRecommendationLoading(false);
      }
    }
    loadModels();
  }, []);

  const refreshSTTModels = useCallback(async () => {
    const models = await window.electron.modelManagement.getModelList('stt');
    setSttModels(models);
  }, []);

  const refreshLLMModels = useCallback(async () => {
    const models = await window.electron.modelManagement.getModelList('llm');
    // LLM 操作完成后只刷新 LLM 区域，避免覆盖语音模型列表。
    setLlmModels(models);
  }, []);

  return (
    <div className="model-manager-page">
      <header className="model-manager-header">
        <div>
          <span className="model-manager-eyebrow">LOCAL AI</span>
          <h1>模型管理</h1>
          <p>下载、删除或选择本机使用的语音识别与语言模型。</p>
        </div>
        <span className="model-manager-summary">
          {sttModels.length + llmModels.length} 个可用模型
        </span>
      </header>
      <main className="model-manager-content">
        <WhisperRuntimePanel
          refreshToken={sttModels
            .map(
              (model) => `${model.id}:${model.downloaded}:${model.activated}`,
            )
            .join('|')}
        />
        <OllamaRuntimePanel
          refreshToken={llmModels
            .map(
              (model) => `${model.id}:${model.downloaded}:${model.activated}`,
            )
            .join('|')}
        />
        <TTSRuntimePanel />
        <EmbeddingModelPanel />
        <ModelRecommendationPanel
          error={recommendationError}
          loading={recommendationLoading}
          recommendation={recommendation}
        />
        <ModelSection
          title="Speech To Text"
          models={sttModels}
          onRefresh={refreshSTTModels}
          modelType="stt"
          recommendedModelId={recommendation?.stt?.id}
        />
        <ModelSection
          title="Large Language Models"
          models={llmModels}
          onRefresh={refreshLLMModels}
          modelType="llm"
          recommendedModelId={recommendation?.llm?.id}
        />
      </main>
    </div>
  );
}
