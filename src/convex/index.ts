import { v } from "convex/values";
import type { StorageAdapter, SchedulerAdapter } from "../adapters";
import type { PipelineStatus, Checkpoint, LogEntry } from "../core/types";

/**
 * Schema field builder. Paste the return value into a Convex defineTable call
 * to give the table the fields cl-pipelines expects:
 *   ...pipelineFields(),
 */
export const pipelineFields = () => ({
  pipelineStatus: v.optional(
    v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("complete"),
      v.literal("error"),
    ),
  ),
  pipelineError: v.optional(v.string()),
  pipelineCheckpoint: v.optional(v.any()),
  pipelineLog: v.optional(
    v.array(
      v.object({
        timestamp: v.number(),
        message: v.string(),
        phase: v.optional(v.string()),
        level: v.optional(v.string()),
      }),
    ),
  ),
});

/**
 * Minimal shape of the Convex action/mutation context we need. Consumers pass
 * their real ctx; we only touch `runMutation`, `runQuery`, and `scheduler`.
 */
type ConvexCtxMinimal = {
  runMutation: (fn: unknown, args: unknown) => Promise<unknown>;
  runQuery: (fn: unknown, args: unknown) => Promise<unknown>;
  scheduler?: { runAfter: (delayMs: number, fn: unknown, args: unknown) => Promise<unknown> };
};

/**
 * References to Convex function definitions the consumer has wired up to
 * their pipeline-backed table. All are required.
 *
 * CONTRACT — each function MUST implement the following semantics:
 *
 * `getJob({ jobId })` — must return
 *   `{ status: PipelineStatus; checkpoint: Checkpoint | null; error?: string } | null`.
 *   Return null for unknown IDs. Consumers are responsible for shaping the
 *   return value from their table row.
 *
 * `setStatus({ jobId, status, error })` — MUST patch the row's `pipelineStatus`
 *   to `status` AND patch `pipelineError` to `error ?? undefined`. When `error`
 *   is null, it means "clear the error". Do NOT conditionally skip the patch
 *   when `error` is nullish — the runtime relies on retries clearing stale errors.
 *
 * `setCheckpoint({ jobId, checkpoint })` — must patch `pipelineCheckpoint` to
 *   `checkpoint`. When `checkpoint` is null/undefined, clear the field.
 *
 * `appendLog({ jobId, timestamp, message, phase?, level? })` — must append one
 *   entry to the row's `pipelineLog` array, creating the array if absent.
 *
 * `clearLog({ jobId })` — must set `pipelineLog` to an empty array `[]`.
 */
export type ConvexPipelineMutations = {
  getJob: unknown;
  setStatus: unknown;
  setCheckpoint: unknown;
  appendLog: unknown;
  clearLog: unknown;
};

export function createConvexStorageAdapter<TState>(config: {
  ctx: ConvexCtxMinimal;
  mutations: ConvexPipelineMutations;
}): StorageAdapter<TState> {
  const { ctx, mutations } = config;
  return {
    async getJob(jobId) {
      const result = (await ctx.runQuery(mutations.getJob, { jobId })) as
        | { status: PipelineStatus; checkpoint: Checkpoint<TState> | null; error?: string }
        | null;
      return result;
    },
    async setStatus(jobId, status, error) {
      // Pass error explicitly — consumers' setStatus mutation must patch
      // pipelineError to undefined when error is not provided, so a retry
      // clears any prior error.
      await ctx.runMutation(mutations.setStatus, { jobId, status, error: error ?? null });
    },
    async setCheckpoint(jobId, checkpoint) {
      await ctx.runMutation(mutations.setCheckpoint, { jobId, checkpoint });
    },
    async appendLog(jobId, entry: LogEntry) {
      await ctx.runMutation(mutations.appendLog, { jobId, ...entry });
    },
    async clearLog(jobId) {
      await ctx.runMutation(mutations.clearLog, { jobId });
    },
  };
}

export function createConvexSchedulerAdapter(config: {
  ctx: ConvexCtxMinimal;
  advanceAction: unknown;
  jobIdArgName?: string;
}): SchedulerAdapter {
  const { ctx, advanceAction } = config;
  const argName = config.jobIdArgName ?? "jobId";
  return {
    async scheduleAdvance(jobId, delayMs) {
      if (!ctx.scheduler) {
        throw new Error(
          "createConvexSchedulerAdapter: ctx.scheduler is required — must be called from an action context",
        );
      }
      await ctx.scheduler.runAfter(delayMs, advanceAction, { [argName]: jobId });
    },
  };
}
