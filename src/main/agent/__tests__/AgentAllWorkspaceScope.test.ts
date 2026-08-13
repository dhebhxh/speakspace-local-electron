import { Note } from '../../entities/Note';
import createAgentReadNoteTool from '../AgentReadNoteTool';
import normalizeAgentRequest from '../AgentInput';
import { AgentContext } from '../AgentTypes';

function makeNote(id: number, workspaceId: number | null): Note {
  const now = new Date();
  return new Note(id, workspaceId, `note-${id}`, null, 'body', false, null, now, now);
}

describe('不限定工作区（workspaceId 为 null）时的行为', () => {
  it('normalizeAgentRequest 接受空工作区而不再报错', () => {
    const request = normalizeAgentRequest({ instruction: '找一下天气' });
    expect(request.workspaceId).toBeNull();
  });

  it('仍然拒绝非法的工作区 ID', () => {
    expect(() =>
      normalizeAgentRequest({ instruction: '找一下', workspaceId: -3 }),
    ).toThrow();
  });

  it('read_note 在不限定工作区时可以读取任意工作区的笔记', async () => {
    const notes = [makeNote(7, 42)];
    const tool = createAgentReadNoteTool({
      findAll: () => notes,
      findAllByWorkspace: () => notes,
      findById: (id: number) => notes.find((n) => n.getId() === id) ?? null,
    });

    const context: AgentContext = { workspaceId: null };
    const result = JSON.parse(await tool.run({ note_id: 7 }, context));

    expect(result.id).toBe(7);
    expect(result.workspaceId).toBe(42);
  });

  it('限定了工作区时仍然拒绝跨区读取', async () => {
    const notes = [makeNote(7, 42)];
    const tool = createAgentReadNoteTool({
      findAll: () => notes,
      findAllByWorkspace: () => notes,
      findById: (id: number) => notes.find((n) => n.getId() === id) ?? null,
    });

    await expect(
      tool.run({ note_id: 7 }, { workspaceId: 1 }),
    ).rejects.toThrow();
  });
});
