import { AgentStep } from '../../../../main/agent/AgentTypes';
import { AgentPageStep } from '../AgentPageTypes';

type Props = { steps: AgentPageStep[]; status: string; running: boolean };

const TOOL_NAMES: Record<string, string> = {
  search_notes: '搜索当前工作空间笔记',
  read_note: '读取选中的笔记',
};

function describeStep(step: AgentStep): string {
  if (step.type === 'final') return '生成最终回答';
  const tool = TOOL_NAMES[step.tool] ?? step.tool;
  if (step.type === 'tool_call') return `准备：${tool}`;
  return `${step.ok ? '完成' : '失败'}：${tool}`;
}

export default function AgentTimeline({ steps, status, running }: Props) {
  return (
    <section className="agent-timeline" aria-live="polite">
      <header>
        <div>
          <span>执行步骤</span>
          <h2>{status}</h2>
        </div>
        <span className={running ? 'is-running' : ''}>
          {running ? '运行中' : '就绪'}
        </span>
      </header>
      {steps.length === 0 ? (
        <p>运行后显示每一步工具调用。</p>
      ) : (
        <ol>
          {steps.map((item) => (
            <li key={item.id}>{describeStep(item.step)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
