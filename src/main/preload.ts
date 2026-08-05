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
      return ipcRenderer.invoke(
          "ModelManagement:getModelList",
          modelType
      );
    },

    downloadModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
          "ModelManagement:downloadModel",
          modelType,
          modelId
      );
    },

    deleteModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
          "ModelManagement:deleteModel",
          modelType,
          modelId
      );
    },

    activateModel(modelType: string, modelId: string) {
      return ipcRenderer.invoke(
          "ModelManagement:activateModel",
          modelType,
          modelId
      );
    }
  },

  workflow: {
    getKnowledgeTemplateList() {
      return ipcRenderer.invoke(
        "Workflow:getKnowledgeTemplateList"
      );
    },

    getKnowledgeTemplateById(id: number) {
      return ipcRenderer.invoke(
        "Workflow:getKnowledgeTemplateById",
        id
      );
    },
    
    createKnowledgeTemplate(name: string, prompt: string) {
      return ipcRenderer.invoke(
        "Workflow:createKnowledgeTemplate",
        name,
        prompt
      )
    },

    updateKnowledgeTemplate(id: number, name: string, prompt: string) {
      return ipcRenderer.invoke(
        "Workflow:updateKnowledgeTemplate",
        id,
        name,
        prompt
      )
    },

    deleteKnowledgeTemplate(id: number) {
      return ipcRenderer.invoke(
        "Workflow:deleteKnowledgeTemplate",
        id
      )
    }
  },

  // 操作方法：渲染进程使用 window.electron.workspace 调用；数据库访问始终留在主进程。
  workspace: {
    getList() {
      return ipcRenderer.invoke('Workspace:getList');
    },
    create(name: string) {
      return ipcRenderer.invoke('Workspace:create', name);
    },
    getNotes(workspaceId: number) {
      return ipcRenderer.invoke('Workspace:getNotes', workspaceId);
    },
    rename(id: number, name: string) {
      return ipcRenderer.invoke('Workspace:rename', id, name);
    },
    delete(id: number) {
      return ipcRenderer.invoke('Workspace:delete', id);
    },
  }
  
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
