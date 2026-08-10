import { ipcMain } from 'electron';

import WorkflowService from '../workflow/WorkflowService';

const workflowService = new WorkflowService();

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
