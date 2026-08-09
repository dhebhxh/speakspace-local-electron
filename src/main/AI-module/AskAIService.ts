import { Message } from 'ollama';

import { LLMModelManager } from './LLMModelManager';
import { AIConversation } from '../entities/AIConversation';
import { AIMessage } from '../entities/AIMessage';
import { Note } from '../entities/Note';
import { Workspace } from '../entities/Workspace';
import { AIConversationRepository } from '../database/repositories/AIConversationRepository';
import { AIMessageRepository } from '../database/repositories/AIMessageRepository';
import { ConversationContextRepository } from '../database/repositories/ConversationContextRepository';
import { NoteRepository } from '../database/repositories/NoteRepository';
import { WorkspaceRepository } from '../database/repositories/WorkspaceRepository';

export type AskAIScope = 'note' | 'workspace';

export type AskAIRequest = {
  conversationId?: number | null;
  noteId?: number | null;
  question: string;
  scope: AskAIScope;
};

export type CreateAskAINoteRequest = {
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

const NOTE_TRANSCRIPT_LIMIT = 2400;
const WORKSPACE_NOTE_LIMIT = 1200;
const MAX_CHAT_HISTORY_MESSAGES = 10;

function clipText(text: string, maxCharacters: number): string {
  const normalizedText = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedText.length <= maxCharacters) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxCharacters).trim()}...`;
}

function serializeConversation(
  conversation: AIConversation,
): AskAIConversationDTO {
  return {
    id: conversation.getId(),
    name: conversation.getName(),
    createdAt: conversation.getCreatedAt().toISOString(),
    updatedAt: conversation.getUpdatedAt().toISOString(),
  };
}

function serializeMessage(message: AIMessage): AskAIMessageDTO {
  return {
    id: message.getId(),
    conversationId: message.getConversationId(),
    role: message.getRole(),
    content: message.getContent(),
    createdAt: message.getCreatedAt().toISOString(),
  };
}

function serializeNote(note: Note): AskAINoteDTO {
  return {
    id: note.getId(),
    workspaceId: note.getWorkspaceId(),
    name: note.getName() || `Note ${note.getId()}`,
    transcriptPreview: clipText(note.getTranscript(), 180),
    updatedAt: note.getUpdatedAt().toISOString(),
  };
}

function createConversationName(question: string): string {
  const cleanQuestion = clipText(question, 64);
  return cleanQuestion || 'Ask AI Conversation';
}

function formatNoteForPrompt(
  note: Note,
  index: number,
  maxCharacters: number,
): string {
  return [
    `[${index + 1}] ${note.getName() || `Note ${note.getId()}`}`,
    `Updated: ${note.getUpdatedAt().toISOString()}`,
    'Transcript:',
    clipText(note.getTranscript(), maxCharacters) || '(empty)',
  ].join('\n');
}

function createSystemPrompt(scope: AskAIScope, notes: Note[]): string {
  const noteLimit =
    scope === 'note' ? NOTE_TRANSCRIPT_LIMIT : WORKSPACE_NOTE_LIMIT;

  const formattedNotes =
    notes.length === 0
      ? '(no saved notes selected)'
      : notes
          .map((note, index) => formatNoteForPrompt(note, index, noteLimit))
          .join('\n\n---\n\n');

  return `You are SpeakSpace Ask AI, a local-first assistant for saved notes.

Answer using only the selected local note transcripts below as factual evidence. Do not use external knowledge. If the selected notes do not contain enough information, say that directly in the user's language.

Scope: ${scope === 'note' ? 'current note' : 'all saved notes'}

Selected notes:
${formattedNotes}`;
}

function toOllamaHistory(messages: AIMessage[]): Message[] {
  return messages
    .filter(
      (message) =>
        message.getRole() === 'user' || message.getRole() === 'assistant',
    )
    .slice(-MAX_CHAT_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.getRole() as Message['role'],
      content: message.getContent(),
    }));
}

export class AskAIService {
  private readonly conversationRepository = new AIConversationRepository();

  private readonly messageRepository = new AIMessageRepository();

  private readonly contextRepository = new ConversationContextRepository();

  private readonly noteRepository = new NoteRepository();

  private readonly workspaceRepository = new WorkspaceRepository();

  private readonly llmModelManager = new LLMModelManager();

  public listNotes(): AskAINoteDTO[] {
    return this.noteRepository.findAll().map(serializeNote);
  }

  public createNote(request: CreateAskAINoteRequest): AskAINoteDTO {
    const transcript = String(request.transcript || '').trim();

    if (!transcript) {
      throw new Error('Note text is required.');
    }

    const now = new Date();
    const note = new Note(
      0,
      this.getOrCreateWorkspaceId(),
      request.name?.trim() || createConversationName(transcript),
      null,
      transcript,
      false,
      null,
      now,
      now,
    );

    const noteId = this.noteRepository.create(note);
    const createdNote = this.noteRepository.findById(noteId);

    if (!createdNote) {
      throw new Error('Saved note could not be loaded.');
    }

    return serializeNote(createdNote);
  }

  public listConversations(): AskAIConversationDTO[] {
    return this.conversationRepository.findAll().map(serializeConversation);
  }

  public getConversation(conversationId: number): {
    conversation: AskAIConversationDTO;
    messages: AskAIMessageDTO[];
    sources: AskAINoteDTO[];
  } {
    const conversation = this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    return {
      conversation: serializeConversation(conversation),
      messages: this.messageRepository
        .findAllByConversation(conversationId)
        .map(serializeMessage),
      sources: this.contextRepository
        .findAllByConversation(conversationId)
        .map(serializeNote),
    };
  }

  public async ask(request: AskAIRequest): Promise<AskAIResultDTO> {
    const question = String(request.question || '').trim();

    if (!question) {
      throw new Error('Question is required.');
    }

    const scope: AskAIScope =
      request.scope === 'workspace' ? 'workspace' : 'note';

    const sourceNotes = this.getSourceNotes(scope, request.noteId || null);

    const conversation = this.getOrCreateConversation(
      request.conversationId || null,
      question,
    );

    this.attachContextNotes(conversation.getId(), sourceNotes);

    const existingMessages = this.messageRepository.findAllByConversation(
      conversation.getId(),
    );

    const directEmptyAnswer = AskAIService.createEmptyContextAnswer(
      scope,
      sourceNotes,
      question,
    );

    let answer: string;
    let modelName: string | null = null;

    if (directEmptyAnswer) {
      answer = directEmptyAnswer;
    } else {
      const promptMessages: Message[] = [
        {
          role: 'system',
          content: createSystemPrompt(scope, sourceNotes),
        },
        ...toOllamaHistory(existingMessages),
        {
          role: 'user',
          content: question,
        },
      ];

      const reply = await this.llmModelManager.generateReply(promptMessages);

      answer = reply.content;
      modelName = reply.modelName;
    }

    this.messageRepository.createForConversation(
      conversation.getId(),
      'user',
      question,
    );

    this.messageRepository.createForConversation(
      conversation.getId(),
      'assistant',
      answer,
    );

    conversation.setUpdatedAt(new Date());
    this.conversationRepository.update(conversation);

    return {
      conversation: serializeConversation(conversation),
      messages: this.messageRepository
        .findAllByConversation(conversation.getId())
        .map(serializeMessage),
      answer,
      modelName,
      scope,
      sources: sourceNotes.map(serializeNote),
    };
  }

  private getOrCreateConversation(
    conversationId: number | null,
    question: string,
  ): AIConversation {
    if (conversationId !== null) {
      const existingConversation =
        this.conversationRepository.findById(conversationId);

      if (!existingConversation) {
        throw new Error('Conversation not found.');
      }

      return existingConversation;
    }

    return this.conversationRepository.createWithName(
      createConversationName(question),
    );
  }

  private getSourceNotes(scope: AskAIScope, noteId: number | null): Note[] {
    if (scope === 'workspace') {
      return this.noteRepository.findAll();
    }

    if (noteId === null) {
      return [];
    }

    const note = this.noteRepository.findById(noteId);

    return note ? [note] : [];
  }

  private getOrCreateWorkspaceId(): number {
    const existingWorkspace = this.workspaceRepository.findAll()[0];

    if (existingWorkspace) {
      return existingWorkspace.getId();
    }

    const now = new Date();
    const workspace = new Workspace(1, 'Default Workspace', now, now);

    this.workspaceRepository.create(workspace);

    return workspace.getId();
  }

  private attachContextNotes(conversationId: number, notes: Note[]): void {
    notes.forEach((note) => {
      if (!this.contextRepository.exists(conversationId, note.getId())) {
        this.contextRepository.addContext(conversationId, note.getId());
      }
    });
  }

  private static createEmptyContextAnswer(
    scope: AskAIScope,
    notes: Note[],
    question: string,
  ): string | null {
    if (notes.length > 0) {
      return null;
    }

    const hasChinese = /[\u3400-\u9fff]/u.test(question);

    if (scope === 'workspace') {
      return hasChinese
        ? '当前工作区还没有可用于回答的已保存笔记。'
        : 'There are no saved notes available for Ask AI yet.';
    }

    return hasChinese
      ? '请先选择一条当前笔记，再向 Ask AI 提问。'
      : 'Select a current note before asking Ask AI.';
  }
}
