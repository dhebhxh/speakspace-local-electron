// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },

  //speakspace-local
  modelManagement: {
    getModelList(modelType: string) {
      return ipcRenderer.invoke('ModelManagement:getModelList', modelType);
    },

    downloadModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
        'ModelManagement:downloadModel',
        modelType,
        modelId,
      );
    },

    deleteModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
        'ModelManagement:deleteModel',
        modelType,
        modelId,
      );
    },

    activateModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
        'ModelManagement:activateModel',
        modelType,
        modelId,
      );
    },
  },

  workflow: {
    getKnowledgeTemplateList() {
      return ipcRenderer.invoke('Workflow:getKnowledgeTemplateList');
    },

    getKnowledgeTemplateById(id: number) {
      return ipcRenderer.invoke('Workflow:getKnowledgeTemplateById', id);
    },

    createKnowledgeTemplate(name: string, prompt: string) {
      return ipcRenderer.invoke(
        'Workflow:createKnowledgeTemplate',
        name,
        prompt,
      );
    },

    updateKnowledgeTemplate(id: number, name: string, prompt: string) {
      return ipcRenderer.invoke(
        'Workflow:updateKnowledgeTemplate',
        id,
        name,
        prompt,
      );
    },

    deleteKnowledgeTemplate(id: number) {
      return ipcRenderer.invoke('Workflow:deleteKnowledgeTemplate', id);
    },
  },

  askAI: {
    listNotes() {
      return ipcRenderer.invoke('AskAI:listNotes');
    },

    listConversations() {
      return ipcRenderer.invoke('AskAI:listConversations');
    },

    getConversation(conversationId: number) {
      return ipcRenderer.invoke('AskAI:getConversation', conversationId);
    },

    ask(request: {
      conversationId?: number | null;
      noteId?: number | null;
      question: string;
      scope: 'note' | 'workspace';
    }) {
      return ipcRenderer.invoke('AskAI:ask', request);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
