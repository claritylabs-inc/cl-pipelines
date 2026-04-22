export class PipelineError extends Error {
  constructor(message: string, public readonly jobId: string, public readonly phase?: string) {
    super(message);
    this.name = "PipelineError";
  }
}

export class PhaseError extends PipelineError {
  constructor(message: string, jobId: string, phase: string, public readonly recoverable: boolean) {
    super(message, jobId, phase);
    this.name = "PhaseError";
  }
}
