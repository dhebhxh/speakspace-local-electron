export type AskAIScope = 'note' | 'workspace' | 'multi-note';

export type AskAIRequest = {
  conversationId?: number | null;
  workspaceId?: number | null;
  noteId?: number | null;
  noteIds?: number[] | null;
  question: string;
  scope: AskAIScope;
};

export type CreateAskAINoteRequest = {
  workspaceId?: number | null;
  name?: string | null;
  transcript: string;
};

export type AskAIConversationDTO = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AskAIMessageDTO = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
};

export type AskAINoteDTO = {
  id: number;
  workspaceId: number | null;
  name: string;
  transcript: string;
  transcriptPreview: string;
  updatedAt: string;
};

export type AskAIResultDTO = {
  conversation: AskAIConversationDTO;
  messages: AskAIMessageDTO[];
  answer: string;
  modelName: string | null;
  scope: AskAIScope;
  sources: AskAINoteDTO[];
};
