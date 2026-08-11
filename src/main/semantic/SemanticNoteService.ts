import { createHash } from 'crypto';
import NoteEmbeddingRepository from '../database/repositories/NoteEmbeddingRepository';
import { NoteRepository } from '../database/repositories/NoteRepository';
import { Note } from '../entities/Note';
import { rankBySimilarity } from './EmbeddingMath';
import OllamaEmbeddingService from './OllamaEmbeddingService';
import {
  composeSemanticNoteText,
  normalizeSemanticQuery,
  normalizeSemanticTopK,
  normalizeSemanticWorkspaceId,
} from './SemanticNoteInput';
import { SemanticNoteResult } from './SemanticTypes';

const MAX_INDEXED_NOTES = 200;
const EMBED_BATCH_SIZE = 16;

type Embedder = Pick<OllamaEmbeddingService, 'modelName' | 'embedMany'>;

/** 为当前笔记集合增量建立索引，并按余弦相似度返回本地结果。 */
export default class SemanticNoteService {
  private readonly notes: NoteRepository;

  private readonly embeddings: NoteEmbeddingRepository;

  private readonly embedder: Embedder;

  public constructor(
    notes = new NoteRepository(),
    embeddings = new NoteEmbeddingRepository(),
    embedder: Embedder = new OllamaEmbeddingService(),
  ) {
    this.notes = notes;
    this.embeddings = embeddings;
    this.embedder = embedder;
  }

  public async search(
    rawQuery: unknown,
    rawWorkspaceId: unknown = null,
    rawTopK: unknown = 5,
  ): Promise<SemanticNoteResult[]> {
    const query = normalizeSemanticQuery(rawQuery);
    const workspaceId = normalizeSemanticWorkspaceId(rawWorkspaceId);
    const topK = normalizeSemanticTopK(rawTopK);
    const notes = (
      workspaceId === null
        ? this.notes.findAll()
        : this.notes.findAllByWorkspace(workspaceId)
    ).slice(0, MAX_INDEXED_NOTES);
    if (notes.length === 0) return [];

    const indexed = await this.ensureIndexed(notes);
    const [queryVector] = await this.embedder.embedMany([query]);
    return rankBySimilarity(queryVector, indexed, topK).map((item) => ({
      id: item.note.getId(),
      workspaceId: item.note.getWorkspaceId(),
      name: item.note.getName() ?? '未命名笔记',
      transcriptPreview: item.note.getTranscript().slice(0, 180),
      score: item.score,
    }));
  }

  private async ensureIndexed(
    notes: Note[],
  ): Promise<Array<{ note: Note; embedding: number[] }>> {
    const indexed: Array<{ note: Note; embedding: number[] }> = [];
    const pending: Array<{ note: Note; text: string; hash: string }> = [];
    notes.forEach((note) => {
      const text = composeSemanticNoteText(note);
      const hash = createHash('sha256').update(text).digest('hex');
      const stored = this.embeddings.find(
        note.getId(),
        this.embedder.modelName,
      );
      if (stored?.contentHash === hash) {
        indexed.push({ note, embedding: stored.embedding });
      } else {
        pending.push({ note, text, hash });
      }
    });

    for (let offset = 0; offset < pending.length; offset += EMBED_BATCH_SIZE) {
      const batch = pending.slice(offset, offset + EMBED_BATCH_SIZE);
      // 批次之间顺序执行，避免同时占满本地模型内存。
      // eslint-disable-next-line no-await-in-loop
      const vectors = await this.embedder.embedMany(
        batch.map((item) => item.text),
      );
      batch.forEach((item, index) => {
        const embedding = vectors[index];
        this.embeddings.upsert(
          item.note.getId(),
          this.embedder.modelName,
          embedding,
          item.hash,
        );
        indexed.push({ note: item.note, embedding });
      });
    }
    return indexed;
  }
}
