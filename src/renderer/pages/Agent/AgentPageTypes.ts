import type { TFunction } from 'i18next';
import { AgentHistoryMessage, AgentStep } from '../../../main/agent/AgentTypes';

export type AgentPageMessage = AgentHistoryMessage & { id: string };
export type AgentPageStep = { id: string; step: AgentStep };

export type AgentPageState = {
  history: AgentPageMessage[];
  steps: AgentPageStep[];
  running: boolean;
  error: string;
  status: string;
};

export const createEmptyAgentPageState = (t: TFunction): AgentPageState => ({
  history: [],
  steps: [],
  running: false,
  error: '',
  status: t('agent.status.initial'),
});
