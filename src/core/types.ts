export type PipelineStatus = "idle" | "running" | "paused" | "complete" | "error";

export type LogEntry = {
  timestamp: number;
  message: string;
  phase?: string;
  level?: "info" | "warn" | "error";
};

export type Checkpoint<TState = unknown> = {
  nextPhase: string;
  state: TState;
  createdAt: number;
};

export type PhaseContext<TState> = {
  jobId: string;
  checkpoint: Checkpoint<TState>;
  log: (message: string, level?: "info" | "warn" | "error") => Promise<void>;
  saveState: (state: TState) => Promise<void>;
};

export type PhaseResult<TState> =
  | { kind: "next"; nextPhase: string; state: TState }
  | { kind: "done" }
  | { kind: "error"; error: string };

export type Phase<TState> = {
  name: string;
  run: (ctx: PhaseContext<TState>) => Promise<PhaseResult<TState>>;
};
