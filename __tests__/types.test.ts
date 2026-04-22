import { describe, it, expect } from "vitest";
import { PipelineError, PhaseError } from "../src/core/errors";

describe("errors", () => {
  it("PhaseError carries phase + recoverable", () => {
    const e = new PhaseError("boom", "job1", "extract", true);
    expect(e.phase).toBe("extract");
    expect(e.recoverable).toBe(true);
    expect(e.jobId).toBe("job1");
    expect(e.name).toBe("PhaseError");
  });

  it("PipelineError without phase", () => {
    const e = new PipelineError("oops", "job1");
    expect(e.phase).toBeUndefined();
    expect(e.name).toBe("PipelineError");
  });
});
