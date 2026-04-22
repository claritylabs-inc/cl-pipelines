import { describe, it, expect } from "vitest";
import { z } from "zod";
import { tool } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { runAgent, type AgentCheckpoint } from "../src/agent";
import { advancePhase } from "../src/core/phase-runner";
import { buildAgentPhase } from "../src/agent/loop";
import { createMemoryStorage, createMemoryScheduler } from "../src/adapters/memory";

// ---------------------------------------------------------------------------
// Mock LanguageModelV2
// ---------------------------------------------------------------------------
// Minimal conformance with the v6 provider interface: specificationVersion,
// provider, modelId, supportedUrls, doGenerate, doStream. doGenerate returns
// { content, finishReason, usage, warnings }. The `content` array is the
// v6-native spot for both text parts and `{ type: "tool-call", toolCallId,
// toolName, input }` (input is a JSON-encoded string).

type ScriptedStep =
  | { type: "tool-call"; toolName: string; input: unknown }
  | { type: "text"; text: string };

function scriptedModel(steps: ScriptedStep[]): LanguageModelV2 {
  let i = 0;
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId: "mock-model",
    supportedUrls: {},
    async doGenerate() {
      const step = steps[Math.min(i, steps.length - 1)];
      i++;
      if (step.type === "tool-call") {
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call_${i}`,
              toolName: step.toolName,
              input: JSON.stringify(step.input),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      }
      return {
        content: [{ type: "text" as const, text: step.text }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("not implemented");
    },
  };
}

function echoTool() {
  return tool({
    description: "echo",
    inputSchema: z.object({ value: z.string() }),
    execute: async ({ value }: { value: string }) => ({ echoed: value }),
  });
}

function bind(
  scheduler: ReturnType<typeof createMemoryScheduler>,
  storage: ReturnType<typeof createMemoryStorage<AgentCheckpoint>>,
  phase: ReturnType<typeof buildAgentPhase>,
) {
  scheduler._bind(async (id) => {
    await advancePhase({ jobId: id, phases: [phase], storage, scheduler });
  });
}

describe("agent primitive", () => {
  it("runs a tool call then terminates on the next text turn", async () => {
    const storage = createMemoryStorage<AgentCheckpoint>();
    const scheduler = createMemoryScheduler();
    const model = scriptedModel([
      { type: "tool-call", toolName: "echo", input: { value: "hi" } },
      { type: "text", text: "all done" },
    ]);
    const tools = { echo: echoTool() };

    const phase = buildAgentPhase({ model, tools, maxTurns: 5 });
    bind(scheduler, storage, phase);

    await runAgent({
      jobId: "j1",
      model,
      tools,
      initialMessages: [{ role: "user", content: "hi" }],
      maxTurns: 5,
      storage,
      scheduler,
    });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("complete");
    expect(job?.checkpoint).toBeNull();
    // Two LLM turns: assistant+tool-result, then final assistant text.
    // The max-turns warning must NOT be present.
    const logs = storage._inspect().get("j1")?.log ?? [];
    expect(logs.some((l) => l.message.includes("maxTurns"))).toBe(false);
  });

  it("terminates with a warning when maxTurns is reached", async () => {
    const storage = createMemoryStorage<AgentCheckpoint>();
    const scheduler = createMemoryScheduler();
    // Always emits a tool call, forever.
    const model = scriptedModel([
      { type: "tool-call", toolName: "echo", input: { value: "loop" } },
    ]);
    const tools = { echo: echoTool() };

    const phase = buildAgentPhase({ model, tools, maxTurns: 3 });
    bind(scheduler, storage, phase);

    await runAgent({
      jobId: "j2",
      model,
      tools,
      initialMessages: [{ role: "user", content: "go" }],
      maxTurns: 3,
      storage,
      scheduler,
    });
    await scheduler.drain();

    const job = await storage.getJob("j2");
    expect(job?.status).toBe("complete");
    const logs = storage._inspect().get("j2")?.log ?? [];
    expect(logs.some((l) => l.message.includes("maxTurns") && l.level === "warn")).toBe(true);
  });
});
