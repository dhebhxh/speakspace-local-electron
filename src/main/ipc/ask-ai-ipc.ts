import { ipcMain } from 'electron';

import {
  AskAIRequest,
  AskAIService,
  AskAIScope,
} from '../AI-module/AskAIService';

const askAIService = new AskAIService();

function normalizeId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeScope(value: unknown): AskAIScope {
  return value === 'workspace' ? 'workspace' : 'note';
}

ipcMain.handle('AskAI:listNotes', () => {
  return askAIService.listNotes();
});

ipcMain.handle(
  'AskAI:createNote',
  (_event, request: { name?: string | null; transcript: string }) => {
    return askAIService.createNote(request);
  },
);

ipcMain.handle('AskAI:listConversations', () => {
  return askAIService.listConversations();
});

ipcMain.handle('AskAI:getConversation', (_event, conversationId: number) => {
  const normalizedConversationId = normalizeId(conversationId);

  if (normalizedConversationId === null) {
    throw new Error('Conversation id is required.');
  }

  return askAIService.getConversation(normalizedConversationId);
});

ipcMain.handle('AskAI:ask', (_event, request: Partial<AskAIRequest>) => {
  return askAIService.ask({
    conversationId: normalizeId(request?.conversationId),
    noteId: normalizeId(request?.noteId),
    question: String(request?.question || ''),
    scope: normalizeScope(request?.scope),
  });
});
