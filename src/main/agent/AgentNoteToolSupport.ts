import { Note } from '@shared/entities/Note';
import { NoteRepository } from '../database/repositories/NoteRepository';
import { AgentContext } from './AgentTypes';

export const MAX_NOTE_PREVIEW_CHARACTERS = 240;

export type AgentNoteSource = Pick<
  NoteRepository,
  'findAll' | 'findAllByWorkspace' | 'findById'
>;

export function previewNoteText(
  value: string,
  limit = MAX_NOTE_PREVIEW_CHARACTERS,
): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

export function serializeAgentNote(note: Note): Record<string, unknown> {
  return {
    id: note.getId(),
    workspaceId: note.getWorkspaceId(),
    name: note.getName() || `Note ${note.getId()}`,
    transcriptPreview: previewNoteText(note.getTranscript()),
  };
}

export function listScopedAgentNotes(
  notes: AgentNoteSource,
  context: AgentContext,
): Note[] {
  return context.workspaceId === null
    ? notes.findAll()
    : notes.findAllByWorkspace(context.workspaceId);
}
