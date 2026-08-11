export type AskAIScope = 'note' | 'workspace';

export type AskAINote = {
  id: number;
  workspaceId: number | null;
  name: string;
  transcript: string;
  transcriptPreview: string;
  updatedAt: string;
};

export type AskAIConversation = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AskAIMessage = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
};

export type AskAIResult = {
  conversation: AskAIConversation;
  messages: AskAIMessage[];
  answer: string;
  modelName: string | null;
  scope: AskAIScope;
  sources: AskAINote[];
};

export type AskAIConversationDetail = {
  conversation: AskAIConversation;
  messages: AskAIMessage[];
  sources: AskAINote[];
};

export function formatAskAIDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
