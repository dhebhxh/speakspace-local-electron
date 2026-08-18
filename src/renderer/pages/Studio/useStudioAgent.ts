import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentEvent, AgentStep } from '../../../main/agent/AgentTypes';
import AgentController from '../Agent/AgentController';

const controller = new AgentController();

export type StudioAgentTurn = {
  id: string;
  question: string;
  answer: string;
  steps: AgentStep[];
};

export type StudioAgentState = {
  turns: StudioAgentTurn[];
  liveSteps: AgentStep[];
  running: boolean;
  status: string;
  error: string;
};

const EMPTY: StudioAgentState = {
  turns: [],
  liveSteps: [],
  running: false,
  status: '',
  error: '',
};

/**
 * 对话工作台里的智能体模式：复用主进程 Agent（搜索 / 读取笔记 / 提取待办），
 * 检索范围固定为全部笔记，运行过程以步骤流的形式回显，
 * 最终答案作为一轮对话追加到列表里。
 */
export default function useStudioAgent() {
  const [state, setState] = useState<StudioAgentState>(EMPTY);
  const activeRunId = useRef<string | null>(null);
  const pendingQuestion = useRef('');

  const handleEvent = useCallback((event: AgentEvent) => {
    if (event.runId !== activeRunId.current) return;

    setState((current) => {
      if (event.type === 'step') {
        return {
          ...current,
          liveSteps: [...current.liveSteps, event.step],
          status:
            event.step.type === 'final' ? '整理答案中…' : '正在使用本地工具…',
        };
      }

      if (event.type === 'completed') {
        return {
          ...current,
          turns: [
            ...current.turns,
            {
              id: event.runId,
              question: pendingQuestion.current,
              answer: event.result.finalText,
              steps: event.result.steps,
            },
          ],
          liveSteps: [],
          running: false,
          status: event.result.completed ? '' : '已在安全上限处停止',
        };
      }

      if (event.type === 'cancelled') {
        return { ...current, liveSteps: [], running: false, status: '已取消' };
      }

      return {
        ...current,
        liveSteps: [],
        running: false,
        error: event.message,
        status: '',
      };
    });

    if (event.type !== 'step') activeRunId.current = null;
  }, []);

  useEffect(() => controller.onEvent(handleEvent), [handleEvent]);

  const run = useCallback(
    async (question: string, linkedNoteIds: number[] = []): Promise<boolean> => {
      const instruction = question.trim();
      if (!instruction) return false;

      pendingQuestion.current = instruction;
      setState((current) => ({
        ...current,
        liveSteps: [],
        running: true,
        error: '',
        status: '正在启动本地助理…',
      }));

      try {
        // 把已有的问答带上，保证多轮追问能延续上下文。
        const started = await controller.start({
          instruction,
          // 助理模式一律不限定工作区：检索覆盖全部笔记，
          // 手动挂上的笔记只作为额外线索传下去。
          workspaceId: null,
          linkedNoteIds,
          history: state.turns.flatMap((turn) => [
            { role: 'user' as const, content: turn.question },
            { role: 'assistant' as const, content: turn.answer },
          ]),
        });
        activeRunId.current = started.runId;
        return true;
      } catch (reason) {
        setState((current) => ({
          ...current,
          running: false,
          status: '',
          error: reason instanceof Error ? reason.message : '启动助理失败',
        }));
        return false;
      }
    },
    [state.turns],
  );

  const cancel = useCallback(async () => {
    if (activeRunId.current) await controller.cancel(activeRunId.current);
  }, []);

  const reset = useCallback(() => {
    activeRunId.current = null;
    pendingQuestion.current = '';
    setState(EMPTY);
  }, []);

  return { agent: state, runAgent: run, cancelAgent: cancel, resetAgent: reset };
}
