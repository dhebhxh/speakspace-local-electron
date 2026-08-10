import { NoteRepository } from '../database/repositories/NoteRepository';
import SemanticNoteService from '../semantic/SemanticNoteService';
import createAgentReadNoteTool from './AgentReadNoteTool';
import createAgentSearchNotesTool from './AgentSearchNotesTool';
import { AgentNoteSource } from './AgentNoteToolSupport';
import { AgentTool } from './AgentTypes';

type AgentNoteToolDependencies = {
  notes?: AgentNoteSource;
  semantic?: Pick<SemanticNoteService, 'search'>;
};

/** 组合 Agent 的只读笔记工具；后续新增工具时保持独立文件。 */
export default function createAgentNoteTools(
  dependencies: AgentNoteToolDependencies = {},
): AgentTool[] {
  const notes = dependencies.notes ?? new NoteRepository();
  const semantic = dependencies.semantic ?? new SemanticNoteService();
  return [
    createAgentSearchNotesTool(notes, semantic),
    createAgentReadNoteTool(notes),
  ];
}
