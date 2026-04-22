import type { Phase, PhaseContext } from "./types";
import type { StorageAdapter, SchedulerAdapter } from "../adapters";
import { PhaseError } from "./errors";
import { resolveStartPhase, type RetryMode } from "./retry";

export type RunPipelineArgs<TState> = {
  jobId: string;
  phases: Phase<TState>[];
  storage: StorageAdapter<TState>;
  scheduler: SchedulerAdapter;
  retryMode?: RetryMode;
  initialState: TState;
  initialPhase?: string;
};

export async function runPipeline<TState>(args: RunPipelineArgs<TState>): Promise<void> {
  const { jobId, phases, storage, scheduler, retryMode, initialState } = args;
  if (phases.length === 0) throw new Error("runPipeline: phases must be non-empty");
  const firstName = args.initialPhase ?? phases[0].name;
  const existing = await storage.getJob(jobId);
  const startName = resolveStartPhase(retryMode, existing?.checkpoint ?? null, firstName);
  const startState =
    retryMode === "full" || !existing?.checkpoint
      ? initialState
      : (existing.checkpoint.state as TState);
  await storage.setStatus(jobId, "running");
  await storage.setCheckpoint(jobId, {
    nextPhase: startName,
    state: startState,
    createdAt: Date.now(),
  });
  await scheduler.scheduleAdvance(jobId, 0);
}

export type AdvancePhaseArgs<TState> = {
  jobId: string;
  phases: Phase<TState>[];
  storage: StorageAdapter<TState>;
  scheduler: SchedulerAdapter;
};

export async function advancePhase<TState>(args: AdvancePhaseArgs<TState>): Promise<void> {
  const { jobId, phases, storage, scheduler } = args;
  const job = await storage.getJob(jobId);
  if (!job || !job.checkpoint) return;
  if (job.status !== "running") return;

  const checkpoint = job.checkpoint;
  const phase = phases.find((p) => p.name === checkpoint.nextPhase);
  if (!phase) {
    await storage.setStatus(jobId, "error", `Unknown phase: ${checkpoint.nextPhase}`);
    return;
  }

  const ctx: PhaseContext<TState> = {
    jobId,
    checkpoint,
    log: async (message, level = "info") =>
      storage.appendLog(jobId, {
        timestamp: Date.now(),
        message,
        phase: phase.name,
        level,
      }),
    saveState: async (state) =>
      storage.setCheckpoint(jobId, {
        nextPhase: phase.name,
        state,
        createdAt: Date.now(),
      }),
  };

  try {
    const result = await phase.run(ctx);
    if (result.kind === "done") {
      await storage.setCheckpoint(jobId, null);
      await storage.setStatus(jobId, "complete");
      return;
    }
    if (result.kind === "error") {
      await storage.setStatus(jobId, "error", result.error);
      return;
    }
    await storage.setCheckpoint(jobId, {
      nextPhase: result.nextPhase,
      state: result.state,
      createdAt: Date.now(),
    });
    await scheduler.scheduleAdvance(jobId, 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.log(`Phase "${phase.name}" threw: ${msg}`, "error");
    await storage.setStatus(jobId, "error", msg);
    throw new PhaseError(msg, jobId, phase.name, true);
  }
}
