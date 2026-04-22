import type { ModelMessage, ToolSet } from "ai";
import type { LanguageModel } from "ai";
import type { Phase } from "../core/types";
import type { StorageAdapter, SchedulerAdapter } from "../adapters";
import type { RetryMode } from "../core/retry";

/**
 * A single message in the agent's running conversation.
 *
 * We alias the AI SDK's `ModelMessage` so the agent's checkpoint state is
 * wire-compatible with `generateText({ messages })`.
 */
export type AgentTurn = ModelMessage;

/**
 * Checkpoint shape persisted between turns.
 *
 * `pendingToolCalls` is reserved for future mid-tool resumption (v0.2). In
 * v0.1 tool calls are always drained synchronously inside a single phase
 * invocation, so this array should be empty at checkpoint boundaries.
 */
export type AgentCheckpoint = {
  messages: AgentTurn[];
  pendingToolCalls: Array<{ id: string; name: string; args: unknown }>;
  turn: number;
};

/**
 * Arguments accepted by `runAgent`.
 *
 * `model` is passed through to the AI SDK's `generateText`; it can be any
 * `LanguageModel` (a `LanguageModelV2` instance, an AI Gateway model string,
 * or a provider factory return value).
 */
export type RunAgentArgs<TOOLS extends ToolSet = ToolSet> = {
  jobId: string;
  model: LanguageModel;
  tools?: TOOLS;
  system?: string;
  initialMessages: AgentTurn[];
  maxTurns?: number;
  storage: StorageAdapter<AgentCheckpoint>;
  scheduler: SchedulerAdapter;
  retryMode?: RetryMode;
};

/**
 * Options for `buildAgentPhase`, the lower-level primitive that returns a
 * single `Phase<AgentCheckpoint>` named `"turn"` you can hand to
 * `runPipeline` yourself.
 */
export type BuildAgentPhaseOpts<TOOLS extends ToolSet = ToolSet> = {
  model: LanguageModel;
  tools?: TOOLS;
  system?: string;
  maxTurns?: number;
};

export type AgentPhase = Phase<AgentCheckpoint>;
