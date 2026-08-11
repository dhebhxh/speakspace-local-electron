import { ipcMain } from 'electron';
import AskAIService from '../ask-ai/AskAIService';
import {
  AskAIRequest,
  AskAIScope,
  CreateAskAINoteRequest,
} from '../ask-ai/AskAITypes';

const askAIService = new AskAIService();

function normalizeId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeScope(value: unknown): AskAIScope {
  return value === 'workspace' ? 'workspace' : 'note';
}

ipcMain.handle('AskAI:listNotes', (_event, workspaceId: unknown) =>
  askAIService.listNotes(normalizeId(workspaceId)),
);

ipcMain.handle(
  'AskAI:createNote',
  (_event, request: Partial<CreateAskAINoteRequest>) =>
    askAIService.createNote({
      workspaceId: normalizeId(request?.workspaceId),
      name: typeof request?.name === 'string' ? request.name : null,
      transcript: String(request?.transcript || ''),
    }),
);

ipcMain.handle('AskAI:listConversations', () =>
  askAIService.listConversations(),
);

ipcMain.handle('AskAI:getConversation', (_event, conversationId: unknown) => {
  const id = normalizeId(conversationId);
  if (id === null) throw new Error('无效的会话 ID / Invalid conversation ID');
  return askAIService.getConversation(id);
});

ipcMain.handle('AskAI:ask', (_event, request: Partial<AskAIRequest>) =>
  askAIService.ask({
    conversationId: normalizeId(request?.conversationId),
    workspaceId: normalizeId(request?.workspaceId),
    noteId: normalizeId(request?.noteId),
    question: String(request?.question || ''),
    scope: normalizeScope(request?.scope),
  }),
);
