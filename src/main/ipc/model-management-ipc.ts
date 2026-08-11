import { ipcMain } from 'electron';

import { STTModelManager } from '../AI-module/STTModelManager';
import { LLMModelManager } from '../AI-module/LLMModelManager';
import ollamaServerController from '../llm/OllamaRuntime';

const sttModelManager = new STTModelManager();
const llmModelManager = new LLMModelManager();

function unsupportedModelType(modelType: string): never {
  throw new Error(`不支持的模型类型 / Unsupported model type: ${modelType}`);
}

ipcMain.handle(
  'ModelManagement:getModelList',
  async (_event, modelType: string) => {
    switch (modelType) {
      case 'stt':
        return sttModelManager.getModelList();
      case 'llm': {
        // 页面读取模型时尝试启动已安装的 Ollama；缺少运行时仍返回目录供 UI 展示。
        await ollamaServerController.ensureRunning().catch(() => undefined);
        return llmModelManager.getModelList();
      }
      default:
        return unsupportedModelType(modelType);
    }
  },
);

ipcMain.handle(
  'ModelManagement:downloadModel',
  async (_event, modelType: string, modelId: string) => {
    switch (modelType) {
      case 'stt':
        return sttModelManager.downloadModel(modelId);
      case 'llm':
        await ollamaServerController.ensureRunning();
        return llmModelManager.downloadModel(modelId);
      default:
        return unsupportedModelType(modelType);
    }
  },
);

ipcMain.handle(
  'ModelManagement:deleteModel',
  async (_event, modelType: string, modelId: string) => {
    switch (modelType) {
      case 'stt':
        return sttModelManager.deleteModel(modelId);
      case 'llm':
        await ollamaServerController.ensureRunning();
        return llmModelManager.deleteModel(modelId);
      default:
        return unsupportedModelType(modelType);
    }
  },
);

ipcMain.handle(
  'ModelManagement:activateModel',
  async (_event, modelType: string, modelId: string) => {
    switch (modelType) {
      case 'stt':
        return sttModelManager.activateModel(modelId);
      case 'llm':
        await ollamaServerController.ensureRunning();
        return llmModelManager.activateModel(modelId);
      default:
        return unsupportedModelType(modelType);
    }
  },
);
