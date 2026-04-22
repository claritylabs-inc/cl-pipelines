import { describe, it, expect } from "vitest";
import { createMemoryStorage, createMemoryScheduler } from "../src/adapters/memory";

describe("memory storage", () => {
  it("roundtrips status + checkpoint + log", async () => {
    const s = createMemoryStorage<{ x: number }>();
    await s.setStatus("j1", "running");
    await s.setCheckpoint("j1", { nextPhase: "a", state: { x: 1 }, createdAt: 1 });
    await s.appendLog("j1", { timestamp: 1, message: "hi" });
    const job = await s.getJob("j1");
    expect(job?.status).toBe("running");
    expect(job?.checkpoint?.nextPhase).toBe("a");
    expect(job?.checkpoint?.state.x).toBe(1);
    expect(s._inspect().get("j1")?.log).toHaveLength(1);
  });

  it("getJob returns null for unknown id", async () => {
    const s = createMemoryStorage();
    expect(await s.getJob("nope")).toBeNull();
  });

  it("setStatus with error persists the error string", async () => {
    const s = createMemoryStorage();
    await s.setStatus("j1", "error", "boom");
    const job = await s.getJob("j1");
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("boom");
  });

  it("clearLog empties the log", async () => {
    const s = createMemoryStorage();
    await s.appendLog("j1", { timestamp: 1, message: "a" });
    await s.appendLog("j1", { timestamp: 2, message: "b" });
    await s.clearLog("j1");
    expect(s._inspect().get("j1")?.log).toHaveLength(0);
  });
});

describe("memory scheduler", () => {
  it("drain invokes bound fn per scheduled job", async () => {
    const sched = createMemoryScheduler();
    const called: string[] = [];
    sched._bind(async (id) => { called.push(id); });
    await sched.scheduleAdvance("j1", 0);
    await sched.scheduleAdvance("j2", 0);
    expect(sched.pending()).toBe(2);
    await sched.drain();
    expect(called).toEqual(["j1", "j2"]);
    expect(sched.pending()).toBe(0);
  });

  it("is a no-op without _bind", async () => {
    const sched = createMemoryScheduler();
    await sched.scheduleAdvance("j1", 0);
    await sched.drain();  // should not throw
    expect(sched.pending()).toBe(0);
  });
});
