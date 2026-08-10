import { AgentNoteSource, previewNoteText } from './AgentNoteToolSupport';
import { AgentTool } from './AgentTypes';

const MAX_READ_CHARACTERS = 2200;

/** 只接受真实数字 ID，并拒绝读取当前工作空间之外的笔记。 */
export default function createAgentReadNoteTool(
  notes: AgentNoteSource,
): AgentTool {
  return {
    schema: {
      type: 'function',
      function: {
        name: 'read_note',
        description:
          'Read one saved note by a real id returned by search_notes.',
        parameters: {
          type: 'object',
          required: ['note_id'],
          properties: {
            note_id: { type: 'integer', description: 'Saved note id.' },
          },
        },
      },
    },
    run: async (args, context) => {
      const noteId = Number(args.note_id);
      if (!Number.isInteger(noteId) || noteId <= 0) {
        throw new Error('无效的笔记 ID / Invalid note id');
      }
      const note = notes.findById(noteId);
      if (!note || note.getWorkspaceId() !== context.workspaceId) {
        throw new Error('当前工作空间中找不到该笔记 / Note not found');
      }
      return JSON.stringify({
        id: note.getId(),
        workspaceId: note.getWorkspaceId(),
        name: note.getName() || `Note ${note.getId()}`,
        transcript: previewNoteText(note.getTranscript(), MAX_READ_CHARACTERS),
      });
    },
  };
}
