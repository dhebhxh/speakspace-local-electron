import { BrowserWindow, ipcMain } from 'electron';

import { STTModelManager } from '../AI-module/STTModelManager';
import { LLMModelManager } from '../AI-module/LLMModelManager';
import TTSModelManager from '../AI-module/TTSModelManager';
import ollamaServerController from '../llm/OllamaRuntime';
import { ttsService } from '../tts/TTSRuntimeCoordinator';

const sttModelManager = new STTModelManager();
const llmModelManager = new LLMModelManager();
const ttsModelManager = new TTSModelManager();

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
      case 'tts':
        return ttsModelManager.getModelList();
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
      case 'tts':
        return ttsModelManager.downloadModel(modelId, (progress) => {
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('Runtime:installTTSProgress', progress);
          });
        });
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
      case 'tts':
        return ttsModelManager.deleteModel(modelId);
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
      case 'tts':
        if (!ttsModelManager.activateModel(modelId)) return false;
        // 模型选择立即释放旧引擎，无需等到下一次合成。
        ttsService.dispose();
        return true;
      default:
        return unsupportedModelType(modelType);
    }
  },
);
