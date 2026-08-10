import { ipcMain } from 'electron';
import LocalChatService from '../llm/LocalChatService';

const localChatService = new LocalChatService();

// Renderer 只提交消息；模型选择和 Ollama 调用全部保留在主进程。
ipcMain.handle('LLM:chat', (_event, messages: unknown, options: unknown) =>
  localChatService.chat(messages, options),
);
