import { generateText, type ModelMessage, type ToolSet } from "ai";
import type { Phase, PhaseResult } from "../core/types";
import { runPipeline } from "../core/phase-runner";
import type {
  AgentCheckpoint,
  BuildAgentPhaseOpts,
  RunAgentArgs,
} from "./types";

const TURN_PHASE = "turn";

/**
 * Build the single phase that drives one LLM turn of an agent.
 *
 * Each invocation of the phase:
 *   1. Calls `generateText` once (default `stopWhen: stepCountIs(1)`, so the
 *      SDK performs one LLM call and, if the model emitted tool calls with
 *      executable tools, runs them and appends tool-result messages).
 *   2. Appends `response.messages` to the running history.
 *   3. If the model emitted tool calls (finishReason === "tool-calls"),
 *      schedules another `"turn"`; otherwise reports `done`.
 *   4. Enforces `maxTurns` by logging a warning and terminating with `done`.
 */
export function buildAgentPhase<TOOLS extends ToolSet = ToolSet>(
  opts: BuildAgentPhaseOpts<TOOLS>,
): Phase<AgentCheckpoint> {
  const { model, tools, system, maxTurns = 10 } = opts;

  return {
    name: TURN_PHASE,
    async run(ctx): Promise<PhaseResult<AgentCheckpoint>> {
      const state = ctx.checkpoint.state;
      const turn = state.turn;

      if (turn >= maxTurns) {
        await ctx.log(
          `agent: maxTurns (${maxTurns}) reached, terminating`,
          "warn",
        );
        return { kind: "done" };
      }

      const messages: ModelMessage[] = state.messages;

      const result = await generateText({
        model,
        system,
        messages,
        // `tools` is typed as optional on generateText; only pass it when set.
        ...(tools ? { tools } : {}),
      });

      // `response.messages` contains the assistant message (including any
      // tool-call parts) and, when tools have an `execute` fn, the
      // corresponding tool-result messages produced in this step.
      const newMessages: ModelMessage[] = [
        ...messages,
        ...result.response.messages,
      ];

      const hasToolCalls =
        result.finishReason === "tool-calls" && result.toolCalls.length > 0;

      const nextState: AgentCheckpoint = {
        messages: newMessages,
        pendingToolCalls: [],
        turn: turn + 1,
      };

      if (!hasToolCalls) {
        await ctx.saveState(nextState);
        return { kind: "done" };
      }

      return { kind: "next", nextPhase: TURN_PHASE, state: nextState };
    },
  };
}

/**
 * Run an agent to completion on top of `runPipeline`.
 *
 * This is a thin convenience wrapper: it builds a single-phase pipeline
 * whose phase is the agent turn, seeds the checkpoint with
 * `initialMessages`, and defers to the storage/scheduler adapters supplied
 * by the caller for durability + scheduling semantics.
 */
export async function runAgent<TOOLS extends ToolSet = ToolSet>(
  args: RunAgentArgs<TOOLS>,
): Promise<void> {
  const phase = buildAgentPhase<TOOLS>({
    model: args.model,
    tools: args.tools,
    system: args.system,
    maxTurns: args.maxTurns,
  });

  const initialState: AgentCheckpoint = {
    messages: args.initialMessages,
    pendingToolCalls: [],
    turn: 0,
  };

  await runPipeline<AgentCheckpoint>({
    jobId: args.jobId,
    phases: [phase],
    storage: args.storage,
    scheduler: args.scheduler,
    retryMode: args.retryMode,
    initialState,
  });
}
