import SemanticNoteService from '../semantic/SemanticNoteService';
import { SemanticNoteResult } from '../semantic/SemanticTypes';
import {
  AgentNoteSource,
  listScopedAgentNotes,
  serializeAgentNote,
} from './AgentNoteToolSupport';
import { AgentTool } from './AgentTypes';

const MAX_KEYWORD_NOTES = 100;
const MAX_RESULTS = 8;

type SemanticSearch = Pick<SemanticNoteService, 'search'>;

function serializeSemantic(
  result: SemanticNoteResult,
): Record<string, unknown> {
  return {
    id: result.id,
    workspaceId: result.workspaceId,
    name: result.name,
    transcriptPreview: result.transcriptPreview,
    score: Number(result.score.toFixed(3)),
    match: 'semantic',
  };
}

/** 先做便宜的关键词匹配，无结果时才调用本地向量模型。 */
export default function createAgentSearchNotesTool(
  notes: AgentNoteSource,
  semantic: SemanticSearch,
): AgentTool {
  return {
    schema: {
      type: 'function',
      function: {
        name: 'search_notes',
        description:
          'Search saved notes inside the current workspace. Omit query to list recent notes.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keywords or meaning.' },
          },
        },
      },
    },
    run: async (args, context) => {
      const query = String(args.query || '')
        .trim()
        .slice(0, 200);
      const candidates = listScopedAgentNotes(notes, context).slice(
        0,
        MAX_KEYWORD_NOTES,
      );
      if (!query) {
        return JSON.stringify({
          match: 'recent',
          notes: candidates.slice(0, MAX_RESULTS).map(serializeAgentNote),
        });
      }

      const term = query.toLocaleLowerCase();
      const keywordMatches = candidates.filter((note) =>
        `${note.getName() || ''}\n${note.getTranscript()}`
          .toLocaleLowerCase()
          .includes(term),
      );
      if (keywordMatches.length > 0) {
        return JSON.stringify({
          match: 'keyword',
          notes: keywordMatches.slice(0, MAX_RESULTS).map(serializeAgentNote),
        });
      }

      try {
        const results = await semantic.search(query, context.workspaceId, 5);
        return JSON.stringify({
          match: 'semantic',
          notes: results.map(serializeSemantic),
        });
      } catch (error) {
        return JSON.stringify({
          match: 'none',
          notes: [],
          hint: 'No keyword match. Semantic search is unavailable.',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
