// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  webUtils,
} from 'electron';

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

  // speakspace-local
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

  // 文件选择和路径解析由 preload/main 提供，Renderer 不获得 Node 文件系统权限。
  audio: {
    pickFile() {
      return ipcRenderer.invoke('Audio:pickFile');
    },
    getPathForFile(file: File) {
      return webUtils.getPathForFile(file);
    },
    getDuration(filePath: string) {
      return ipcRenderer.invoke('Audio:getDuration', filePath);
    },
    saveRecording(data: ArrayBuffer, mimeType: string) {
      return ipcRenderer.invoke('Audio:saveRecording', data, mimeType);
    },
    discardRecording(relativePath: string) {
      return ipcRenderer.invoke('Audio:discardRecording', relativePath);
    },
  },

  // 单次转写接口先用于功能接线；任务进度、取消和重试由后续 job API 提供。
  transcription: {
    run(
      source:
        | { kind: 'file'; filePath: string }
        | { kind: 'recording'; relativePath: string },
    ) {
      return ipcRenderer.invoke('Transcription:run', source);
    },
    start(
      source:
        | { kind: 'file'; filePath: string }
        | { kind: 'recording'; relativePath: string },
    ) {
      return ipcRenderer.invoke('Transcription:start', source);
    },
    get(jobId: string) {
      return ipcRenderer.invoke('Transcription:get', jobId);
    },
    cancel(jobId: string) {
      return ipcRenderer.invoke('Transcription:cancel', jobId);
    },
    retry(jobId: string) {
      return ipcRenderer.invoke('Transcription:retry', jobId);
    },
    onStatus(listener: (job: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, job: unknown) => listener(job);
      ipcRenderer.on('Transcription:status', wrapped);
      return () => {
        ipcRenderer.removeListener('Transcription:status', wrapped);
      };
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

  // 通用外观设置通过主进程持久化，renderer 只调用此安全接口。
  settings: {
    get() {
      return ipcRenderer.invoke('Settings:get');
    },
    update(settings: {
      fontSize: 'small' | 'medium' | 'large';
      theme: 'light' | 'dark' | 'system';
    }) {
      return ipcRenderer.invoke('Settings:update', settings);
    },
  },

  // 智能推荐只返回本机硬件摘要和本地分类建议，不执行自动下载或改名。
  recommendation: {
    getModels(sttModels: unknown[], llmModels: unknown[]) {
      return ipcRenderer.invoke(
        'Recommendation:getModels',
        sttModels,
        llmModels,
      );
    },
    getWorkspace() {
      return ipcRenderer.invoke('Recommendation:getWorkspace');
    },
  },

  // 运行时状态为只读汇总；下载和删除仍由各模型管理接口单独处理。
  runtime: {
    getStatus() {
      return ipcRenderer.invoke('Runtime:getStatus');
    },
    installWhisper() {
      return ipcRenderer.invoke('Runtime:installWhisper');
    },
    onInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Runtime:installProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Runtime:installProgress', wrapped);
      };
    },
  },

  // 操作方法：通过 window.electron.workspace 调用，数据库访问保留在主进程。
  // Usage: call through window.electron.workspace; database access stays in main.
  workspace: {
    getList(limit = 6) {
      return ipcRenderer.invoke('Workspace:getList', limit);
    },
    create(name: string) {
      return ipcRenderer.invoke('Workspace:create', name);
    },
    open(workspaceId: number) {
      return ipcRenderer.invoke('Workspace:open', workspaceId);
    },
    getNotes(workspaceId: number) {
      return ipcRenderer.invoke('Workspace:getNotes', workspaceId);
    },
    getNoteAudio(workspaceId: number, noteId: number) {
      return ipcRenderer.invoke('Workspace:getNoteAudio', workspaceId, noteId);
    },
    rename(id: number, name: string) {
      return ipcRenderer.invoke('Workspace:rename', id, name);
    },
    delete(id: number) {
      return ipcRenderer.invoke('Workspace:delete', id);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
