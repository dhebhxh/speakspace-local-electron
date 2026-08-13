import type { TFunction } from 'i18next';
import { AgentEvent } from '../../../main/agent/AgentTypes';
import { AgentPageState } from './AgentPageTypes';

/** 把主进程公开事件转换成页面状态，不在这里执行任何 IPC。 */
export default function reduceAgentPageEvent(
  current: AgentPageState,
  event: AgentEvent,
  instruction: string,
  t: TFunction,
): AgentPageState {
  if (event.type === 'step') {
    return {
      ...current,
      steps: [
        ...current.steps,
        { id: `${event.runId}-${current.steps.length}`, step: event.step },
      ],
      status:
        event.step.type === 'final'
          ? t('agent.status.completed')
          : t('agent.status.usingTools'),
    };
  }
  if (event.type === 'completed') {
    return {
      ...current,
      history: [
        ...current.history,
        { id: `${event.runId}-user`, role: 'user', content: instruction },
        {
          id: `${event.runId}-assistant`,
          role: 'assistant',
          content: event.result.finalText,
        },
      ],
      running: false,
      status: event.result.completed
        ? t('agent.status.completed')
        : t('agent.status.safetyStop'),
    };
  }
  if (event.type === 'cancelled') {
    return { ...current, running: false, status: t('agent.status.cancelled') };
  }
  return {
    ...current,
    running: false,
    error: event.message,
    status: t('agent.status.failed'),
  };
}
