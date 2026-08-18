import { Message } from 'ollama';
import { readToolCall } from './AgentToolCalls';
import {
  emitAgentStep,
  runAgentTool,
  throwIfAgentAborted,
} from './AgentRunSupport';
import {
  AgentChat,
  AgentRunRequest,
  AgentRunResult,
  AgentStep,
  AgentTool,
} from './AgentTypes';

const DEFAULT_MAX_STEPS = 6;
const SYSTEM_PROMPT = `You are SpeakSpace's local note assistant. Use one registered tool at a time when the user's saved notes are needed. search_notes covers every saved note the user has, so always search there first instead of assuming a note is out of reach. Never invent note ids or tool results. When the user asks about tasks, action items, deadlines or reminders, call extract_todos on the relevant note so the items are saved to their to-do list. If a tool fails, explain briefly or choose another registered tool. When finished, reply concisely in the user's language. Do not reveal private reasoning.`;

/** 挂上的笔记只是给模型的提示，不能变成检索范围的限制。 */
function describeLinkedNotes(linkedNoteIds: number[]): string {
  return `The user pinned these note ids to this conversation: ${linkedNoteIds.join(
    ', ',
  )}. Treat them as extra context worth reading, but still search all saved notes when looking for anything else.`;
}

type AgentDependencies = {
  chat: AgentChat;
  tools: AgentTool[];
  maxSteps?: number;
  systemPrompt?: string;
};

/** 有界工具循环：每轮最多执行一个已注册工具，达到上限后自动停止。 */
export default class AgentOrchestrator {
  private readonly chat: AgentChat;

  private readonly tools: Map<string, AgentTool>;

  private readonly maxSteps: number;

  private readonly systemPrompt: string;

  public constructor(dependencies: AgentDependencies) {
    this.chat = dependencies.chat;
    this.tools = new Map(
      dependencies.tools.map((tool) => [tool.schema.function.name ?? '', tool]),
    );
    this.maxSteps = dependencies.maxSteps ?? DEFAULT_MAX_STEPS;
    this.systemPrompt = dependencies.systemPrompt ?? SYSTEM_PROMPT;
  }

  public async run(
    request: Required<AgentRunRequest>,
    signal?: AbortSignal,
    onStep?: (step: AgentStep) => void,
  ): Promise<AgentRunResult> {
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...(request.linkedNoteIds.length > 0
        ? [
            {
              role: 'system',
              content: describeLinkedNotes(request.linkedNoteIds),
            } as Message,
          ]
        : []),
      ...request.history,
      { role: 'user', content: request.instruction },
    ];
    const steps: AgentStep[] = [];
    let modelName = '';

    for (let index = 0; index < this.maxSteps; index += 1) {
      throwIfAgentAborted(signal);
      // 工具轮必须顺序执行，让后一轮模型能读取前一轮结果。
      // eslint-disable-next-line no-await-in-loop
      const reply = await this.chat(
        messages,
        Array.from(this.tools.values()).map((tool) => tool.schema),
        signal,
      );
      modelName = reply.modelName;
      messages.push(reply.message);
      const call = readToolCall(reply.message);

      if (!call) {
        const finalText = reply.message.content?.trim();
        if (!finalText) throw new Error('Agent 模型返回了空内容');
        const finalStep: AgentStep = { type: 'final', text: finalText };
        emitAgentStep(steps, finalStep, onStep);
        return { finalText, modelName, steps, completed: true };
      }

      emitAgentStep(
        steps,
        { type: 'tool_call', tool: call.name, args: call.args },
        onStep,
      );
      // eslint-disable-next-line no-await-in-loop
      const result = await runAgentTool(
        this.tools.get(call.name),
        call.name,
        call.args,
        {
          workspaceId: request.workspaceId,
          linkedNoteIds: request.linkedNoteIds,
        },
        signal,
      );
      emitAgentStep(steps, result.step, onStep);
      messages.push({
        role: 'tool',
        tool_name: call.name,
        content: result.modelContent,
      });
    }

    const finalText = '已达到 6 步安全上限，请缩小任务范围后重试。';
    const finalStep: AgentStep = {
      type: 'final',
      text: finalText,
      truncated: true,
    };
    emitAgentStep(steps, finalStep, onStep);
    return { finalText, modelName, steps, completed: false };
  }
}
