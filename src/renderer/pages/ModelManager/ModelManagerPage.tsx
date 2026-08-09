import { useCallback, useEffect, useState } from 'react';
import { ModelSection } from './components/ModelSection';
import { STTModel } from '../../../main/AI-module/STTModel';
import { LLMModel } from '../../../main/AI-module/LLMModel';
import './ModelManagerPage.css';

// 保留命名导出，与现有路由导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export function ModelManagerPage() {
  const [sttModels, setSttModels] = useState<STTModel[]>([]);

  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);

  useEffect(() => {
    async function loadModels() {
      const stt = await window.electron.modelManagement.getModelList('stt');
      const llm = await window.electron.modelManagement.getModelList('llm');

      setSttModels(stt);
      setLlmModels(llm);
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
        <ModelSection
          title="Speech To Text"
          models={sttModels}
          onRefresh={refreshSTTModels}
          modelType="stt"
        />
        <ModelSection
          title="Large Language Models"
          models={llmModels}
          onRefresh={refreshLLMModels}
          modelType="llm"
        />
      </main>
    </div>
  );
}
