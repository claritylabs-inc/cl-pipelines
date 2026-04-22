import type { PipelineStatus, Checkpoint, LogEntry } from "../core/types";

export type StorageAdapter<TState> = {
  getJob(jobId: string): Promise<{
    status: PipelineStatus;
    checkpoint: Checkpoint<TState> | null;
    error?: string;
  } | null>;
  setStatus(jobId: string, status: PipelineStatus, error?: string): Promise<void>;
  setCheckpoint(jobId: string, checkpoint: Checkpoint<TState> | null): Promise<void>;
  appendLog(jobId: string, entry: LogEntry): Promise<void>;
  clearLog(jobId: string): Promise<void>;
};

export type SchedulerAdapter = {
  scheduleAdvance(jobId: string, delayMs: number): Promise<void>;
};
