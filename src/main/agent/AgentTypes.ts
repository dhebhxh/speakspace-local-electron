import { Message, Tool } from 'ollama';

export type AgentHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentRunRequest = {
  instruction: string;
  workspaceId?: number | null;
  /** 用户手动挂上的笔记，只是额外线索，不收窄检索范围。 */
  linkedNoteIds?: number[];
  history?: AgentHistoryMessage[];
};

export type AgentToolCallStep = {
  type: 'tool_call';
  tool: string;
  args: Record<string, unknown>;
};

export type AgentToolResultStep = {
  type: 'tool_result';
  tool: string;
  ok: boolean;
  result: string;
};

export type AgentFinalStep = {
  type: 'final';
  text: string;
  truncated?: boolean;
};

export type AgentStep =
  | AgentToolCallStep
  | AgentToolResultStep
  | AgentFinalStep;

export type AgentRunResult = {
  finalText: string;
  modelName: string;
  steps: AgentStep[];
  completed: boolean;
};

export type AgentRunStarted = { runId: string };

export type AgentEvent =
  | { runId: string; type: 'step'; step: AgentStep }
  | { runId: string; type: 'completed'; result: AgentRunResult }
  | { runId: string; type: 'cancelled' }
  | { runId: string; type: 'error'; message: string };

export type AgentContext = {
  workspaceId: number | null;
  /** 用户挂上的笔记 ID：工具用它把这些笔记额外置顶，而不是据此过滤。 */
  linkedNoteIds?: number[];
};

export type AgentTool = {
  schema: Tool;
  run(
    args: Record<string, unknown>,
    context: AgentContext,
    signal?: AbortSignal,
  ): Promise<string>;
};

export type AgentChatReply = {
  message: Message;
  modelName: string;
};

export type AgentChat = (
  messages: Message[],
  tools: Tool[],
  signal?: AbortSignal,
) => Promise<AgentChatReply>;
