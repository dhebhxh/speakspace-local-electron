import { FormEvent, useState } from 'react';
import { WorkspaceItem } from '../../Workspace/WorkspaceController';

type Props = {
  workspaces: WorkspaceItem[];
  workspaceId: number | null;
  running: boolean;
  onWorkspaceChange(workspaceId: number): void;
  onStart(instruction: string): Promise<void>;
  onCancel(): Promise<void>;
};

export default function AgentTaskPanel({
  workspaces,
  workspaceId,
  running,
  onWorkspaceChange,
  onStart,
  onCancel,
}: Props) {
  const [instruction, setInstruction] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!instruction.trim() || workspaceId === null || running) return;
    const task = instruction;
    setInstruction('');
    await onStart(task);
  };

  return (
    <form className="agent-task-panel" onSubmit={submit}>
      <label htmlFor="agent-workspace">
        <span>工作空间</span>
        <select
          disabled={running || workspaces.length === 0}
          id="agent-workspace"
          onChange={(event) => onWorkspaceChange(Number(event.target.value))}
          value={workspaceId ?? ''}
        >
          {workspaces.length === 0 && <option value="">暂无工作空间</option>}
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} · {workspace.note_count} 篇笔记
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="agent-instruction">
        <span>任务</span>
        <textarea
          disabled={running}
          id="agent-instruction"
          maxLength={4000}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="例如：查找产品发布的笔记并总结时间安排"
          rows={5}
          value={instruction}
        />
      </label>
      <div>
        {running ? (
          <button className="secondary" onClick={onCancel} type="button">
            取消任务
          </button>
        ) : (
          <button
            disabled={!instruction.trim() || workspaceId === null}
            type="submit"
          >
            开始执行
          </button>
        )}
      </div>
    </form>
  );
}
