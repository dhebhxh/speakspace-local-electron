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

  transcription: {
    start() {
      return ipcRenderer.invoke(
        "Transcription:start"
      )
    },

    stop() {
      return ipcRenderer.invoke(
        "Transcription:stop"
      )
    },

    save(title: string) {
      return ipcRenderer.invoke(
        "Transcription:save",
        title
      )
    },

    discard() {
      return ipcRenderer.invoke(
        "Transcription:discard"
      )
    },

    sendChunk(chunk: Blob) {
      ipcRenderer.send(
        "Transcription:sendChunk",
        chunk
      )
    },

    onText(callback: (id: number, text: string) => void) {
      const subscription = (_event: IpcRendererEvent, id: number, text: string) =>callback(id, text);

      ipcRenderer.on("Transcription:onText", subscription);

      return () => {
        ipcRenderer.removeListener("Transcription:onText", subscription);
      };
    },

  },
  
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
