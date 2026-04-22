import type { StorageAdapter, SchedulerAdapter } from "./index";
import type { Checkpoint, LogEntry, PipelineStatus } from "../core/types";

type MemoryJob<TState> = {
  status: PipelineStatus;
  checkpoint: Checkpoint<TState> | null;
  error?: string;
  log: LogEntry[];
};

export type MemoryStorage<TState> = StorageAdapter<TState> & {
  _inspect(): Map<string, MemoryJob<TState>>;
};

export function createMemoryStorage<TState>(): MemoryStorage<TState> {
  const jobs = new Map<string, MemoryJob<TState>>();
  const get = (id: string): MemoryJob<TState> => {
    let j = jobs.get(id);
    if (!j) {
      j = { status: "idle", checkpoint: null, log: [] };
      jobs.set(id, j);
    }
    return j;
  };
  return {
    async getJob(id) {
      const j = jobs.get(id);
      if (!j) return null;
      return { status: j.status, checkpoint: j.checkpoint, error: j.error };
    },
    async setStatus(id, status, error) {
      const j = get(id);
      j.status = status;
      j.error = error;
    },
    async setCheckpoint(id, cp) {
      const j = get(id);
      j.checkpoint = cp;
    },
    async appendLog(id, entry) {
      const j = get(id);
      j.log.push(entry);
    },
    async clearLog(id) {
      const j = get(id);
      j.log = [];
    },
    _inspect: () => jobs,
  };
}

export type MemoryScheduler = SchedulerAdapter & {
  drain(): Promise<void>;
  pending(): number;
  _bind(fn: (jobId: string) => Promise<void>): void;
};

export function createMemoryScheduler(): MemoryScheduler {
  const queue: Array<() => Promise<void>> = [];
  let advanceFn: ((jobId: string) => Promise<void>) | null = null;
  return {
    async scheduleAdvance(jobId, _delayMs) {
      queue.push(async () => {
        if (advanceFn) await advanceFn(jobId);
      });
    },
    async drain() {
      while (queue.length) {
        await queue.shift()!();
      }
    },
    pending: () => queue.length,
    _bind: (fn) => {
      advanceFn = fn;
    },
  };
}
