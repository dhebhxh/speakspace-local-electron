import { ipcMain } from 'electron';

import { KnowledgeTemplate } from '../entities/KnowledgeTemplate';
import { KnowledgeTemplateRepository } from '../database/repositories/KnowledgeTemplateRepository';

const knowledgeTemplateRepositoy = new KnowledgeTemplateRepository();

function serializeKnowledgeTemplate(knowledgeTemplate: KnowledgeTemplate) {
  return {
    id: knowledgeTemplate.getId(),
    name: knowledgeTemplate.getName(),
    prompt: knowledgeTemplate.getPrompt(),
    createdAt: knowledgeTemplate.getCreatedAt().toISOString(),
    updatedAt: knowledgeTemplate.getUpdatedAt().toISOString(),
  };
}

ipcMain.handle('Workflow:getKnowledgeTemplateList', () => {
  return knowledgeTemplateRepositoy.findAll().map(serializeKnowledgeTemplate);
});

ipcMain.handle('Workflow:getKnowledgeTemplateById', (_event, id: number) => {
  const knowledgeTemplate = knowledgeTemplateRepositoy.findById(id);

  return knowledgeTemplate
    ? serializeKnowledgeTemplate(knowledgeTemplate)
    : null;
});

ipcMain.handle(
  'Workflow:createKnowledgeTemplate',
  (_event, name: string, prompt: string) => {
    return knowledgeTemplateRepositoy.create(name, prompt);
  },
);

ipcMain.handle(
  'Workflow:updateKnowledgeTemplate',
  (_event, id: number, name: string, prompt: string) => {
    return knowledgeTemplateRepositoy.update(id, name, prompt);
  },
);

ipcMain.handle('Workflow:deleteKnowledgeTemplate', (_event, id: number) => {
  return knowledgeTemplateRepositoy.deleteById(id);
});
