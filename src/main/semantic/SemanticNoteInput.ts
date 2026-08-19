import { Note } from '@shared/entities/Note';

const MAX_EMBED_CHARACTERS = 4_000;

export function composeSemanticNoteText(note: Note): string {
  return `${note.getName() ?? ''}\n${note.getTranscript()}`
    .trim()
    .slice(0, MAX_EMBED_CHARACTERS);
}

export function normalizeSemanticQuery(value: unknown): string {
  const query = typeof value === 'string' ? value.trim() : '';
  if (!query) throw new Error('语义搜索内容不能为空');
  return query.slice(0, 500);
}

export function normalizeSemanticWorkspaceId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('无效的工作空间 ID');
  return id;
}

export function normalizeSemanticTopK(value: unknown): number {
  const topK = Number(value);
  return Number.isInteger(topK) ? Math.min(20, Math.max(1, topK)) : 5;
}
