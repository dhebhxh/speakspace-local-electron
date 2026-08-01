import { ipcMain } from "electron";

import { KnowledgeTemplate } from "../entities/KnowledgeTemplate";
import { KnowledgeTemplateRepository } from "../database/repositories/KnowledgeTemplateRepository";


const knowledgeTemplateRepositoy = new KnowledgeTemplateRepository();

ipcMain.handle(
    "Workflow:getKnowledgeTemplateList",
    (_event) => {
        return knowledgeTemplateRepositoy.findAll();
    }
)

ipcMain.handle(
    "Workflow:getKnowledgeTemplateById",
    (_event, id: number) => {
        return knowledgeTemplateRepositoy.findById(id);
    }
)

ipcMain.handle(
    "Workflow:createKnowledgeTemplate",
    (_event, name: string, prompt: string) => {
        return knowledgeTemplateRepositoy.create(name, prompt);
    }
)

ipcMain.handle(
    "Workflow:updateKnowledgeTemplate",
    (_event, id: number, name: string, prompt: string) => {
        return knowledgeTemplateRepositoy.update(id, name, prompt);
    }
)

ipcMain.handle(
    "Workflow:deleteKnowledgeTemplate",
    (_event, id: number) => {
        return knowledgeTemplateRepositoy.deleteById(id);
    }
)