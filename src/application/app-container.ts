import { DatabaseManager } from "@/database";
import { AiConversationRepository } from "@/repositories/ai-conversation-repository";
import { AiMessageRepository } from "@/repositories/ai-message-repository";
import { ConversationContextRepository } from "@/repositories/conversation-context-repository";
import { NoteRepository } from "@/repositories/note-repository";
import { LlmModelRepository } from "@/repositories/llm-model-repository";
import { SttModelRepository } from "@/repositories/stt-model-repository";
import { TtsModelRepository } from "@/repositories/tts-model-repository";
import { WorkspaceRepository } from "@/repositories/workspace-repository";
import { AiConversationService } from "@/services/ai-conversation-service";
import { NoteService } from "@/services/note-service";
import { LlmInferenceService } from "@/services/llm-inference-service";
import { LlmModelService } from "@/services/llm-model-service";
import { SttModelService } from "@/services/stt-model-service";
import { TtsModelService } from "@/services/tts-model-service";
import { WorkspaceService } from "@/services/workspace-service";
import { TranscriptionService } from "@/services/transcription-service";
import { KnowledgeDocumentRepository } from "@/repositories/knowledge-document-repository";
import { KnowledgeService } from "@/services/knowledge-service";
import { CoreNoteInsightRepository } from "@/repositories/core-note-insight-repository";
import { CoreNoteInsightService } from "@/services/core-note-insight-service";
import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";

export class AppContainer {
  public readonly workspaceService: WorkspaceService;
  public readonly noteService: NoteService;
  public readonly llmModelService: LlmModelService;
  public readonly sttModelService: SttModelService;
  public readonly ttsModelService: TtsModelService;
  public readonly transcriptionService: TranscriptionService;
  public readonly knowledgeService: KnowledgeService;
  public readonly coreNoteInsightService: CoreNoteInsightService;
  public readonly aiConversationService: AiConversationService;
  public readonly llmInferenceService: LlmInferenceService;

  public constructor(databaseManager: DatabaseManager) {
    const workspaceRepository = new WorkspaceRepository(databaseManager);
    const noteRepository = new NoteRepository(databaseManager);
    const llmModelRepository = new LlmModelRepository(databaseManager);
    const sttModelRepository = new SttModelRepository(databaseManager);
    const ttsModelRepository = new TtsModelRepository(databaseManager);
    const knowledgeDocumentRepository = new KnowledgeDocumentRepository(databaseManager);
    const coreNoteInsightRepository = new CoreNoteInsightRepository(databaseManager);
    const aiConversationRepository = new AiConversationRepository(databaseManager);
    const aiMessageRepository = new AiMessageRepository(databaseManager);
    const conversationContextRepository = new ConversationContextRepository(
      databaseManager,
    );
    const localLlmCoordinator = new LocalLlmCoordinator();

    this.workspaceService = new WorkspaceService(workspaceRepository);
    this.noteService = new NoteService(noteRepository);
    this.llmModelService = new LlmModelService(llmModelRepository, localLlmCoordinator);
    this.knowledgeService = new KnowledgeService(knowledgeDocumentRepository, this.llmModelService, localLlmCoordinator);
    this.coreNoteInsightService = new CoreNoteInsightService(coreNoteInsightRepository, this.llmModelService, localLlmCoordinator);
    this.sttModelService = new SttModelService(sttModelRepository);
    this.ttsModelService = new TtsModelService(ttsModelRepository);
    this.transcriptionService = new TranscriptionService(this.sttModelService);
    this.aiConversationService = new AiConversationService(
      aiConversationRepository,
      aiMessageRepository,
      conversationContextRepository,
      noteRepository,
    );
    this.llmInferenceService = new LlmInferenceService(
      this.llmModelService,
      this.aiConversationService,
      localLlmCoordinator,
    );
  }
}
