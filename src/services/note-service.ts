import { Note } from "@/domain/note/note";
import { NoteNotFoundError } from "@/errors/note-not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { NoteRepository } from "@/repositories/note-repository";

export class NoteService {
  public constructor(private readonly noteRepository: NoteRepository) {}

  public async getNotesByWorkspace(workspaceId: string): Promise<Note[]> {
    if (workspaceId.trim().length === 0) {
      throw new ValidationError("Workspace id cannot be empty.");
    }

    return this.noteRepository.findByWorkspaceId(workspaceId);
  }

  public async getNote(id: string): Promise<Note | null> {
    return this.noteRepository.findById(id);
  }

  public async createNote(
    workspaceId: string,
    name: string | null,
    transcript: string,
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
      null,
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
    const note = await this.noteRepository.findById(id);

    if (note === null) {
      throw new NoteNotFoundError(id);
    }

    await this.noteRepository.delete(id);
  }

  private createId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
