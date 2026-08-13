import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentEvent } from '../../../main/agent/AgentTypes';
import { WorkspaceItem } from '../Workspace/WorkspaceController';
import AgentController from './AgentController';
import reduceAgentPageEvent from './AgentPageEventReducer';
import { AgentPageState, createEmptyAgentPageState } from './AgentPageTypes';

const controller = new AgentController();

/** 保留本页会话历史；关闭应用后不会额外持久化 Agent 运行记录。 */
export default function useAgentPage() {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [page, setPage] = useState<AgentPageState>(() =>
    createEmptyAgentPageState(t),
  );
  const activeRunId = useRef<string | null>(null);
  const pendingInstruction = useRef('');

  useEffect(() => {
    controller
      .listWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        setWorkspaceId((current) => current ?? items[0]?.id ?? null);
        return undefined;
      })
      .catch((reason) =>
        setPage((current) => ({
          ...current,
          error:
            reason instanceof Error
              ? reason.message
              : t('workspace.error.load'),
        })),
      );
  }, [t]);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (event.runId !== activeRunId.current) return;
      setPage((current) =>
        reduceAgentPageEvent(current, event, pendingInstruction.current, t),
      );
      if (event.type !== 'step') activeRunId.current = null;
    },
    [t],
  );

  useEffect(() => controller.onEvent(handleEvent), [handleEvent]);

  const start = async (instruction: string) => {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction || workspaceId === null || page.running) return;
    try {
      pendingInstruction.current = cleanInstruction;
      setPage((current) => ({
        ...current,
        steps: [],
        running: true,
        error: '',
        status: t('agent.status.starting'),
      }));
      const started = await controller.start({
        instruction: cleanInstruction,
        workspaceId,
        history: page.history,
      });
      activeRunId.current = started.runId;
    } catch (reason) {
      setPage((current) => ({
        ...current,
        running: false,
        error:
          reason instanceof Error ? reason.message : t('agent.error.start'),
      }));
    }
  };

  const cancel = async () => {
    if (activeRunId.current) await controller.cancel(activeRunId.current);
  };

  const selectWorkspace = (nextWorkspaceId: number) => {
    setWorkspaceId(nextWorkspaceId);
    setPage(createEmptyAgentPageState(t));
    activeRunId.current = null;
    pendingInstruction.current = '';
  };

  return { workspaces, workspaceId, selectWorkspace, page, start, cancel };
}
