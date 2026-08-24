import type { LlamaContext, RNLlamaOAICompatibleMessage } from "llama.rn";

import { TRANSCRIPT_TOO_LONG_ERROR } from "../constants/ask-ai-grounding-policy.ts";
import { ASK_AI_PROMPT_BUDGET } from "../constants/ask-ai-inference-config.ts";
import { InferenceError } from "../errors/inference-error.ts";

import { buildGroundedCompletionMessages } from "./ask-ai-grounded-messages.ts";
import type { TranscriptContextBlock } from "./ask-ai-grounded-messages.ts";

type FitMessagesResult = {
  messages: RNLlamaOAICompatibleMessage[];
  promptTokenCount: number;
  historyTrimmed: boolean;
};

export async function countFormattedPromptTokens(
  context: LlamaContext,
  messages: RNLlamaOAICompatibleMessage[],
): Promise<number> {
  const formatted = await context.getFormattedChat(messages, null, {
    jinja: true,
    enable_thinking: false,
    reasoning_format: "none",
  });
  const prompt = formatted.prompt ?? "";
  const { tokens } = await context.tokenize(prompt);
  return tokens.length;
}

/**
 * Fits grounded messages into the prompt budget.
 * Transcript text is never trimmed. Older history messages may be dropped.
 */
export async function fitGroundedMessagesToBudget(
  context: LlamaContext,
  transcriptBlocks: TranscriptContextBlock[],
  history: { role: string; content: string }[],
  promptBudget: number = ASK_AI_PROMPT_BUDGET,
): Promise<FitMessagesResult> {
  if (history.length === 0) {
    throw new InferenceError("Conversation history is empty.");
  }

  let trimmedHistory = [...history];
  let historyTrimmed = false;

  while (true) {
    const messages = buildGroundedCompletionMessages(
      transcriptBlocks,
      trimmedHistory,
    );
    const promptTokenCount = await countFormattedPromptTokens(context, messages);

    if (promptTokenCount <= promptBudget) {
      return { messages, promptTokenCount, historyTrimmed };
    }

    if (trimmedHistory.length <= 1) {
      throw new InferenceError(TRANSCRIPT_TOO_LONG_ERROR);
    }

    trimmedHistory = trimOldestConversationTurn(trimmedHistory);
    historyTrimmed = true;
  }
}

function trimOldestConversationTurn(
  history: { role: string; content: string }[],
): { role: string; content: string }[] {
  if (history.length <= 1) {
    return history;
  }

  const removeCount =
    history[0]?.role === "user" && history[1]?.role === "assistant" ? 2 : 1;
  let trimmed = history.slice(removeCount);

  while (trimmed.length > 1 && trimmed[0]?.role === "assistant") {
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}
