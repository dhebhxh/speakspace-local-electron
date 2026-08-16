import { DatabaseManager } from "@/database";
import { NoteRepository } from "@/repositories/note-repository";
import { SttModelRepository } from "@/repositories/stt-model-repository";
import { WorkspaceRepository } from "@/repositories/workspace-repository";
import { NoteService } from "@/services/note-service";
import { SttModelService } from "@/services/stt-model-service";
import { WorkspaceService } from "@/services/workspace-service";

export class AppContainer {
  public readonly workspaceService: WorkspaceService;
  public readonly noteService: NoteService;
  public readonly sttModelService: SttModelService;

  public constructor(databaseManager: DatabaseManager) {
    const workspaceRepository = new WorkspaceRepository(databaseManager);
    const noteRepository = new NoteRepository(databaseManager);
    const sttModelRepository = new SttModelRepository(databaseManager);

    this.workspaceService = new WorkspaceService(workspaceRepository);
    this.noteService = new NoteService(noteRepository);
    this.sttModelService = new SttModelService(sttModelRepository);
  }
}
