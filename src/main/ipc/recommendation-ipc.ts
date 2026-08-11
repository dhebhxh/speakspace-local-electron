import { ipcMain } from 'electron';
import ModelRecommendationService from '../recommendation/ModelRecommendationService';
import WorkspaceSuggestionService from '../workspace/WorkspaceSuggestionService';

const workspaceSuggestionService = new WorkspaceSuggestionService();

// IPC 仅转发检测请求；硬件评分和 Workspace 分类规则保留在各自服务中。
ipcMain.handle(
  'Recommendation:getModels',
  (_event, sttModels: unknown, llmModels: unknown) =>
    ModelRecommendationService.recommend(sttModels, llmModels),
);

ipcMain.handle('Recommendation:getWorkspace', () =>
  workspaceSuggestionService.getSuggestion(),
);
