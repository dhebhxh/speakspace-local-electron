import { useTranslation } from 'react-i18next';
import { AgentStep } from '../../../../main/agent/AgentTypes';
import { AgentPageStep } from '../AgentPageTypes';

type Props = { steps: AgentPageStep[]; status: string; running: boolean };

export default function AgentTimeline({ steps, status, running }: Props) {
  const { t } = useTranslation();
  const describeStep = (step: AgentStep): string => {
    if (step.type === 'final') return t('agent.timeline.final');
    const tool = t(`agent.tool.${step.tool}`, { defaultValue: step.tool });
    if (step.type === 'tool_call') {
      return t('agent.timeline.preparing', { tool });
    }
    return t(step.ok ? 'agent.timeline.done' : 'agent.timeline.failed', {
      tool,
    });
  };

  return (
    <section className="agent-timeline" aria-live="polite">
      <header>
        <div>
          <span>{t('agent.timeline.title')}</span>
          <h2>{status}</h2>
        </div>
        <span className={running ? 'is-running' : ''}>
          {running ? t('agent.timeline.running') : t('agent.timeline.ready')}
        </span>
      </header>
      {steps.length === 0 ? (
        <p>{t('agent.timeline.empty')}</p>
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
