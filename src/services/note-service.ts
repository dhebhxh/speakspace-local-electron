import { File, Paths } from "expo-file-system";

import { Note } from "@/domain/note/note";
import { NoteNotFoundError } from "@/errors/note-not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { NoteRepository } from "@/repositories/note-repository";
import { WorkspaceRepository } from "@/repositories/workspace-repository";

export class NoteService {
  public constructor(
    private readonly noteRepository: NoteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  public async getNotesByWorkspace(workspaceId: string): Promise<Note[]> {
    if (workspaceId.trim().length === 0) {
      throw new ValidationError("Workspace id cannot be empty.");
    }

    return this.noteRepository.findByWorkspaceId(workspaceId);
  }

  public async getAllNotes(): Promise<Note[]> {
    return this.noteRepository.findAll();
  }

  public async getNote(id: string): Promise<Note | null> {
    return this.noteRepository.findById(id);
  }

  public async getTranscriptNotes(): Promise<Note[]> {
    return this.noteRepository.findAllWithTranscript();
  }

  public async searchNotes(query: string): Promise<Note[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) return [];
    return this.noteRepository.search(normalizedQuery);
  }

  public async renameNote(id: string, name: string): Promise<void> {
    const note = await this.getNoteOrThrow(id);
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      throw new ValidationError("Note title cannot be empty.");
    }
    note.rename(normalizedName);
    await this.noteRepository.update(note);
  }

  public async setNotePinned(id: string, isPinned: boolean): Promise<void> {
    const note = await this.getNoteOrThrow(id);

    if (note.getIsPinned() === isPinned) return;

    if (isPinned) {
      note.pin();
    } else {
      note.unpin();
    }

    await this.noteRepository.update(note);
  }

  public async moveNote(id: string, workspaceId: string): Promise<void> {
    const note = await this.getNoteOrThrow(id);
    const normalizedWorkspaceId = workspaceId.trim();
    if (normalizedWorkspaceId.length === 0) {
      throw new ValidationError("Target workspace cannot be empty.");
    }
    if (note.getWorkspaceId() === normalizedWorkspaceId) {
      throw new ValidationError("Note is already in this workspace.");
    }
    if ((await this.workspaceRepository.findById(normalizedWorkspaceId)) === null) {
      throw new ValidationError("Target workspace does not exist.");
    }
    note.moveToWorkspace(normalizedWorkspaceId);
    await this.noteRepository.update(note);
  }

  public async createNote(
    workspaceId: string,
    name: string | null,
    transcript: string,
    audioRelativePath: string | null = null,
  ): Promise<Note> {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedTranscript = transcript.trim();

    if (normalizedWorkspaceId.length === 0) {
      throw new ValidationError("Workspace id cannot be empty.");
    }

    if (normalizedTranscript.length === 0) {
      throw new ValidationError("Note transcript cannot be empty.");
    }

    const normalizedName = name?.trim() || null;
    const now = new Date().toISOString();
    const note = new Note(
      this.createId(),
      normalizedWorkspaceId,
      normalizedName,
      audioRelativePath,
      normalizedTranscript,
      false,
      null,
      now,
      now,
    );

    await this.noteRepository.create(note);
    return note;
  }

  public async updateNote(note: Note): Promise<void> {
    if (note.getTranscript().trim().length === 0) {
      throw new ValidationError("Note transcript cannot be empty.");
    }

    await this.noteRepository.update(note);
  }

  public async deleteNote(id: string): Promise<void> {
    const note = await this.getNoteOrThrow(id);

    await this.noteRepository.delete(id);
    const audioRelativePath = note.getAudioRelativePath();
    if (audioRelativePath !== null) {
      const audioFile = new File(
        Paths.document,
        ...audioRelativePath.split("/"),
      );
      if (audioFile.exists) {
        audioFile.delete();
      }
    }
  }

  private async getNoteOrThrow(id: string): Promise<Note> {
    const note = await this.noteRepository.findById(id);
    if (note === null) throw new NoteNotFoundError(id);
    return note;
  }

  private createId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
