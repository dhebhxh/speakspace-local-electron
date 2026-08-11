import { ipcMain } from 'electron';

import ollamaServerController from '../llm/OllamaRuntime';
import StructuredNoteService from '../workflow/StructuredNoteService';
import WorkflowService from '../workflow/WorkflowService';

const workflowService = new WorkflowService();
const structuredNoteService = new StructuredNoteService();

ipcMain.handle('Workflow:getKnowledgeTemplateList', () => {
  return workflowService.listTemplates();
});

ipcMain.handle('Workflow:getKnowledgeTemplateById', (_event, id: number) => {
  return workflowService.getTemplate(id);
});

ipcMain.handle(
  'Workflow:createKnowledgeTemplate',
  (_event, name: string, prompt: string) => {
    return workflowService.createTemplate(name, prompt);
  },
);

ipcMain.handle(
  'Workflow:updateKnowledgeTemplate',
  (_event, id: number, name: string, prompt: string) => {
    return workflowService.updateTemplate(id, name, prompt);
  },
);

ipcMain.handle('Workflow:deleteKnowledgeTemplate', (_event, id: number) => {
  return workflowService.deleteTemplate(id);
});

ipcMain.handle('Workflow:getKnowledgeOutputs', (_event, noteId: number) => {
  return structuredNoteService.listOutputs(noteId);
});

// 生成前按需启动本机 Ollama；生成结果由主进程直接保存，Renderer 不接触数据库。
ipcMain.handle(
  'Workflow:generateKnowledgeOutput',
  async (_event, noteId: number, templateId: number) => {
    await ollamaServerController.ensureRunning();
    return structuredNoteService.generate(noteId, templateId);
  },
);
