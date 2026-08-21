import { ipcMain } from 'electron';
import type { KnowledgeScenario } from '@shared/types/KnowledgeGenerationTypes';
import KnowledgeGenerationService from '../knowledge/KnowledgeGenerationService';

const service = new KnowledgeGenerationService();
const id = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error('Invalid note id.');
  return parsed;
};
ipcMain.handle('Knowledge:get', (_event, noteId) => service.get(id(noteId)));
ipcMain.handle('Knowledge:generateStructuredNote', (_event, noteId) =>
  service.generateStructuredNote(id(noteId)),
);
ipcMain.handle(
  'Knowledge:generateScenario',
  (_event, noteId, scenario: KnowledgeScenario) =>
    service.generateScenario(id(noteId), scenario),
);
ipcMain.handle('Knowledge:toggleTask', (_event, noteId, taskId, completed) =>
  service.toggleTask(id(noteId), String(taskId), completed === true),
);
