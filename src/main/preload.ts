// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  webUtils,
} from 'electron';
import { AgentEvent, AgentRunRequest } from './agent/AgentTypes';
import type { TranscriptionSource } from './transcription/TranscriptionTypes';

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
    importRecordingFile(filePath: string) {
      return ipcRenderer.invoke('Audio:importRecordingFile', filePath);
    },
    discardRecording(relativePath: string) {
      return ipcRenderer.invoke('Audio:discardRecording', relativePath);
    },
  },

  // 单次转写接口先用于功能接线；任务进度、取消和重试由后续 job API 提供。
  transcription: {
    run(source: TranscriptionSource) {
      return ipcRenderer.invoke('Transcription:run', source);
    },
    detectLanguage(source: TranscriptionSource) {
      return ipcRenderer.invoke('Transcription:detectLanguage', source);
    },
    start(source: TranscriptionSource) {
      return ipcRenderer.invoke('Transcription:start', source);
    },
    liveRun(data: ArrayBuffer, mimeType: string) {
      return ipcRenderer.invoke('Transcription:liveRun', data, mimeType);
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
    onPartial(listener: (payload: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, payload: unknown) =>
        listener(payload);
      ipcRenderer.on('Transcription:partial', wrapped);
      return () => {
        ipcRenderer.removeListener('Transcription:partial', wrapped);
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

    // 操作方法：选择一篇已有笔记和一个模板后调用生成；结果会自动保存。
    getKnowledgeOutputs(noteId: number) {
      return ipcRenderer.invoke('Workflow:getKnowledgeOutputs', noteId);
    },

    generateKnowledgeOutput(noteId: number, templateId: number) {
      return ipcRenderer.invoke(
        'Workflow:generateKnowledgeOutput',
        noteId,
        templateId,
      );
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
    installOllama() {
      return ipcRenderer.invoke('Runtime:installOllama');
    },
    installTTS() {
      return ipcRenderer.invoke('Runtime:installTTS');
    },
    removeTTS() {
      return ipcRenderer.invoke('Runtime:removeTTS');
    },
    installFfmpeg() {
      return ipcRenderer.invoke('Runtime:installFfmpeg');
    },
    onInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Runtime:installProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Runtime:installProgress', wrapped);
      };
    },
    onOllamaInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Runtime:installOllamaProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Runtime:installOllamaProgress', wrapped);
      };
    },
    onFfmpegInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Runtime:installFfmpegProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Runtime:installFfmpegProgress', wrapped);
      };
    },
    onTTSInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Runtime:installTTSProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Runtime:installTTSProgress', wrapped);
      };
    },
  },

  // 本地聊天仅接受角色和文字，主进程会再次校验并使用当前激活模型。
  llm: {
    chat(
      messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>,
      options: { temperature?: number } = {},
    ) {
      return ipcRenderer.invoke('LLM:chat', messages, options);
    },
  },

  // TTS 在主进程异步合成，Renderer 只接收可播放的 PCM 样本。
  tts: {
    getStatus() {
      return ipcRenderer.invoke('TTS:getStatus');
    },
    synthesize(
      text: string,
      options: { speakerId?: number; speed?: number } = {},
    ) {
      return ipcRenderer.invoke('TTS:synthesize', text, options);
    },
  },

  // 语义索引仅保存于本机 SQLite，Embedding 与搜索均复用本机 Ollama。
  semantic: {
    getStatus() {
      return ipcRenderer.invoke('Semantic:getStatus');
    },
    installModel() {
      return ipcRenderer.invoke('Semantic:installModel');
    },
    removeModel() {
      return ipcRenderer.invoke('Semantic:removeModel');
    },
    search(query: string, workspaceId?: number | null, topK = 5) {
      return ipcRenderer.invoke('Semantic:search', query, workspaceId, topK);
    },
    onInstallProgress(listener: (progress: unknown) => void) {
      const wrapped = (_event: IpcRendererEvent, progress: unknown) =>
        listener(progress);
      ipcRenderer.on('Semantic:installProgress', wrapped);
      return () => {
        ipcRenderer.removeListener('Semantic:installProgress', wrapped);
      };
    },
  },

  // Agent 只能调用主进程注册的本地工具；步骤事件不包含模型私有推理。
  agent: {
    start(request: AgentRunRequest) {
      return ipcRenderer.invoke('Agent:start', request);
    },
    cancel(runId: string) {
      return ipcRenderer.invoke('Agent:cancel', runId);
    },
    onEvent(listener: (event: AgentEvent) => void) {
      const wrapped = (_event: IpcRendererEvent, agentEvent: AgentEvent) =>
        listener(agentEvent);
      ipcRenderer.on('Agent:event', wrapped);
      return () => {
        ipcRenderer.removeListener('Agent:event', wrapped);
      };
    },
  },

  // Ask AI 通过主进程读取笔记和保存会话，Renderer 不直接接触 SQLite。
  askAI: {
    listNotes(workspaceId?: number | null) {
      return ipcRenderer.invoke('AskAI:listNotes', workspaceId);
    },
    createNote(request: {
      workspaceId?: number | null;
      name?: string | null;
      transcript: string;
    }) {
      return ipcRenderer.invoke('AskAI:createNote', request);
    },
    listConversations() {
      return ipcRenderer.invoke('AskAI:listConversations');
    },
    getConversation(conversationId: number) {
      return ipcRenderer.invoke('AskAI:getConversation', conversationId);
    },
    ask(request: {
      conversationId?: number | null;
      workspaceId?: number | null;
      noteId?: number | null;
      noteIds?: number[] | null;
      question: string;
      scope: 'note' | 'workspace' | 'multi-note';
    }) {
      return ipcRenderer.invoke('AskAI:ask', request);
    },
    autoSegmentNote(noteId: number) {
      return ipcRenderer.invoke('AskAI:autoSegmentNote', noteId);
    },
  },

  dashboard: {
    getDashboardOverview() {
      return ipcRenderer.invoke('Dashboard:getDashboardOverview');
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
    saveTranscriptionNote(request: {
      workspaceId: number;
      name?: string | null;
      transcript: string;
      summaries?: string[];
      audioRelativePath?: string | null;
    }) {
      return ipcRenderer.invoke('Workspace:saveTranscriptionNote', request);
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

  // Export functionality
  export: {
    note(request: {
      title: string;
      transcript: string;
      subnotes: { type: string; content: string }[];
      format: 'word' | 'pdf';
    }) {
      return ipcRenderer.invoke('Export:note', request);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
