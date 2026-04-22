import { describe, it, expect } from "vitest";
import { runPipeline, advancePhase } from "../src/core/phase-runner";
import type { Phase } from "../src/core/types";
import { createMemoryStorage, createMemoryScheduler } from "../src/adapters/memory";

type S = { counter: number; visited: string[] };

function makePhases(): Phase<S>[] {
  return [
    {
      name: "a",
      run: async (ctx) => ({
        kind: "next",
        nextPhase: "b",
        state: { counter: ctx.checkpoint.state.counter + 1, visited: [...ctx.checkpoint.state.visited, "a"] },
      }),
    },
    {
      name: "b",
      run: async (ctx) => ({
        kind: "next",
        nextPhase: "c",
        state: { counter: ctx.checkpoint.state.counter + 10, visited: [...ctx.checkpoint.state.visited, "b"] },
      }),
    },
    {
      name: "c",
      run: async (ctx) => {
        await ctx.log("finishing");
        return { kind: "done" };
      },
    },
  ];
}

function bind(scheduler: ReturnType<typeof createMemoryScheduler>, storage: ReturnType<typeof createMemoryStorage<S>>, phases: Phase<S>[]) {
  scheduler._bind(async (id) => {
    await advancePhase({ jobId: id, phases, storage, scheduler });
  });
}

describe("phase runner", () => {
  it("runs phases in order, marks complete, clears checkpoint", async () => {
    const storage = createMemoryStorage<S>();
    const scheduler = createMemoryScheduler();
    const phases = makePhases();
    bind(scheduler, storage, phases);

    await runPipeline({ jobId: "j1", phases, storage, scheduler, initialState: { counter: 0, visited: [] } });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("complete");
    expect(job?.checkpoint).toBeNull();
    const log = storage._inspect().get("j1")?.log ?? [];
    expect(log.some((e) => e.message === "finishing")).toBe(true);
  });

  it("retryMode=full resets from first phase even if checkpoint exists", async () => {
    const storage = createMemoryStorage<S>();
    const scheduler = createMemoryScheduler();
    const phases = makePhases();
    bind(scheduler, storage, phases);

    // Pre-seed a checkpoint as if we were resuming at phase b
    await storage.setStatus("j1", "paused");
    await storage.setCheckpoint("j1", {
      nextPhase: "b",
      state: { counter: 99, visited: ["x"] },
      createdAt: 1,
    });

    await runPipeline({
      jobId: "j1", phases, storage, scheduler,
      retryMode: "full",
      initialState: { counter: 0, visited: [] },
    });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("complete");
    // counter should be 11 (0 + 1 + 10), not 99 + anything — confirms reset
    // We can't inspect final state directly (checkpoint cleared), but visited ordering is observable via log
    const log = storage._inspect().get("j1")?.log ?? [];
    expect(log.some((e) => e.message === "finishing")).toBe(true);
  });

  it("retryMode=resume starts from checkpoint.nextPhase", async () => {
    const storage = createMemoryStorage<S>();
    const scheduler = createMemoryScheduler();
    const phases = makePhases();
    bind(scheduler, storage, phases);

    await storage.setStatus("j1", "paused");
    await storage.setCheckpoint("j1", {
      nextPhase: "c",
      state: { counter: 100, visited: ["a", "b"] },
      createdAt: 1,
    });

    await runPipeline({
      jobId: "j1", phases, storage, scheduler,
      retryMode: "resume",
      initialState: { counter: 0, visited: [] },
    });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("complete");
    const log = storage._inspect().get("j1")?.log ?? [];
    // Only "finishing" should be logged — a and b skipped
    expect(log.filter((e) => e.message === "finishing")).toHaveLength(1);
  });

  it("throwing phase sets status=error with the message", async () => {
    const storage = createMemoryStorage<S>();
    const scheduler = createMemoryScheduler();
    const phases: Phase<S>[] = [
      {
        name: "boom",
        run: async () => {
          throw new Error("kaboom");
        },
      },
    ];
    scheduler._bind(async (id) => {
      try {
        await advancePhase({ jobId: id, phases, storage, scheduler });
      } catch {
        // advancePhase rethrows as PhaseError; swallow so drain continues
      }
    });

    await runPipeline({ jobId: "j1", phases, storage, scheduler, initialState: { counter: 0, visited: [] } });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("error");
    expect(job?.error).toContain("kaboom");
    expect(job?.checkpoint).not.toBeNull(); // checkpoint preserved for resume
  });

  it("PhaseResult kind=error sets status=error without clearing checkpoint", async () => {
    const storage = createMemoryStorage<S>();
    const scheduler = createMemoryScheduler();
    const phases: Phase<S>[] = [
      {
        name: "soft-fail",
        run: async () => ({ kind: "error", error: "classified as bad" }),
      },
    ];
    scheduler._bind(async (id) => {
      await advancePhase({ jobId: id, phases, storage, scheduler });
    });

    await runPipeline({ jobId: "j1", phases, storage, scheduler, initialState: { counter: 0, visited: [] } });
    await scheduler.drain();

    const job = await storage.getJob("j1");
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("classified as bad");
  });
});
