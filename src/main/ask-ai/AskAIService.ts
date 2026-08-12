import { AIConversationRepository } from '../database/repositories/AIConversationRepository';
import { AIMessageRepository } from '../database/repositories/AIMessageRepository';
import { ConversationContextRepository } from '../database/repositories/ConversationContextRepository';
import { AIConversation } from '../entities/AIConversation';
import { NoteRepository } from '../database/repositories/NoteRepository';
import { SubnoteRepository } from '../database/repositories/SubnoteRepository';
import { Subnote } from '../entities/Subnote';
import LocalChatService from '../llm/LocalChatService';
import AskAINoteService from './AskAINoteService';
import {
  buildAskAIMessages,
  createEmptyContextAnswer,
} from './AskAIPromptBuilder';
import {
  createConversationName,
  serializeConversation,
  serializeMessage,
  serializeNote,
} from './AskAISerializer';
import {
  AskAIConversationDTO,
  AskAINoteDTO,
  AskAIRequest,
  AskAIResultDTO,
  CreateAskAINoteRequest,
} from './AskAITypes';

const MAX_QUESTION_CHARACTERS = 5000;

type AskAIServiceDependencies = {
  conversationRepository?: AIConversationRepository;
  messageRepository?: AIMessageRepository;
  contextRepository?: ConversationContextRepository;
  noteService?: AskAINoteService;
  chatService?: LocalChatService;
  noteRepository?: NoteRepository;
  subnoteRepository?: SubnoteRepository;
};

/** 协调笔记证据、会话持久化和本地 Ollama 回复。 */
export default class AskAIService {
  private readonly conversationRepository: AIConversationRepository;

  private readonly messageRepository: AIMessageRepository;

  private readonly contextRepository: ConversationContextRepository;

  private readonly noteService: AskAINoteService;

  private readonly chatService: LocalChatService;

  private readonly noteRepository: NoteRepository;

  private readonly subnoteRepository: SubnoteRepository;

  public constructor(dependencies: AskAIServiceDependencies = {}) {
    this.conversationRepository =
      dependencies.conversationRepository ?? new AIConversationRepository();
    this.messageRepository =
      dependencies.messageRepository ?? new AIMessageRepository();
    this.contextRepository =
      dependencies.contextRepository ?? new ConversationContextRepository();
    this.noteService = dependencies.noteService ?? new AskAINoteService();
    this.chatService = dependencies.chatService ?? new LocalChatService();
    this.noteRepository = dependencies.noteRepository ?? new NoteRepository();
    this.subnoteRepository = dependencies.subnoteRepository ?? new SubnoteRepository();
  }

  public listNotes(workspaceId: number | null = null): AskAINoteDTO[] {
    return this.noteService.list(workspaceId).map(serializeNote);
  }

  public createNote(request: CreateAskAINoteRequest): AskAINoteDTO {
    return serializeNote(this.noteService.create(request));
  }

  public listConversations(): AskAIConversationDTO[] {
    return this.conversationRepository.findAll().map(serializeConversation);
  }

  public getConversation(conversationId: number) {
    const conversation = this.requireConversation(conversationId);
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

  public async autoSegmentNote(noteId: number): Promise<void> {
    try {
      const note = this.noteRepository.findById(noteId);
      if (!note || !note.getTranscript().trim()) return;

      const prompt = `Please analyze the following transcript and provide a structured summary.
Break down the transcript into logical segments based on the topics discussed.
For each segment, provide a brief title and a concise bullet-point summary of what that part specifically refers to or what actions were decided.

Transcript:
${note.getTranscript()}`;

      const reply = await this.chatService.chat([{ role: 'user', content: prompt }]);
      
      if (reply && reply.content) {
        const subnote = new Subnote(
          0,
          noteId,
          'AI Auto Segmentation',
          reply.content,
          new Date()
        );
        this.subnoteRepository.create(subnote);
      }
    } catch (error) {
      console.error('Failed to auto-segment note:', error);
    }
  }

  public async ask(request: AskAIRequest): Promise<AskAIResultDTO> {
    const question = AskAIService.normalizeQuestion(request.question);
    const scope = request.scope;
    const existingConversation = request.conversationId
      ? this.requireConversation(request.conversationId)
      : null;
    const history = existingConversation
      ? this.messageRepository.findAllByConversation(
          existingConversation.getId(),
        )
      : [];
    const sources = this.noteService.getSources(
      scope,
      request.workspaceId ?? null,
      request.noteId ?? null,
      request.noteIds ?? null,
    );
    const directAnswer = createEmptyContextAnswer(scope, sources, question);
    const reply = directAnswer
      ? { content: directAnswer, modelName: null }
      : await this.chatService.chat(
          buildAskAIMessages(scope, sources, history, question),
        );
    const conversation =
      existingConversation ??
      this.conversationRepository.createWithName(
        createConversationName(question),
      );

    this.attachSources(
      conversation.getId(),
      sources.map((note) => note.getId()),
    );
    this.messageRepository.createForConversation(
      conversation.getId(),
      'user',
      question,
    );
    this.messageRepository.createForConversation(
      conversation.getId(),
      'assistant',
      reply.content,
    );
    conversation.setUpdatedAt(new Date());
    this.conversationRepository.update(conversation);

    return {
      ...this.getConversation(conversation.getId()),
      answer: reply.content,
      modelName: reply.modelName,
      scope,
    };
  }

  private requireConversation(id: number): AIConversation {
    const conversation = this.conversationRepository.findById(id);
    if (!conversation) throw new Error('会话不存在 / Conversation not found');
    return conversation;
  }

  private attachSources(conversationId: number, noteIds: number[]): void {
    noteIds.forEach((noteId) => {
      if (!this.contextRepository.exists(conversationId, noteId)) {
        this.contextRepository.addContext(conversationId, noteId);
      }
    });
  }

  private static normalizeQuestion(value: unknown): string {
    const question = typeof value === 'string' ? value.trim() : '';
    if (!question) throw new Error('问题不能为空 / Question is required');
    if (question.length > MAX_QUESTION_CHARACTERS) {
      throw new Error(`问题不能超过 ${MAX_QUESTION_CHARACTERS} 个字符`);
    }
    return question;
  }
}
