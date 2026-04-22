import type { Checkpoint } from "./types";

export type RetryMode = "resume" | "full";

export function resolveStartPhase<TState>(
  mode: RetryMode | undefined,
  checkpoint: Checkpoint<TState> | null,
  initialPhase: string,
): string {
  if (mode === "full" || !checkpoint) return initialPhase;
  return checkpoint.nextPhase;
}
