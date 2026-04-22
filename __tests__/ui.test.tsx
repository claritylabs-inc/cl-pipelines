import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { StatusBanner, ProgressLog } from "../src/ui";

describe("StatusBanner primitives", () => {
  it("renders nothing for idle", () => {
    expect(
      renderToString(
        <StatusBanner status="idle"><StatusBanner.Title /></StatusBanner>,
      ),
    ).toBe("");
  });

  it("renders nothing for complete", () => {
    expect(
      renderToString(
        <StatusBanner status="complete"><StatusBanner.Title /></StatusBanner>,
      ),
    ).toBe("");
  });

  it("renders running with data-status attribute + custom title", () => {
    const html = renderToString(
      <StatusBanner status="running">
        <StatusBanner.Title>Extracting</StatusBanner.Title>
      </StatusBanner>,
    );
    expect(html).toContain('data-status="running"');
    expect(html).toContain("Extracting");
  });

  it("renders default title when children omitted", () => {
    const html = renderToString(
      <StatusBanner status="running">
        <StatusBanner.Title />
      </StatusBanner>,
    );
    expect(html).toContain("Running");
  });
});

describe("ProgressLog", () => {
  it("renders latest entry only when latestOnly", () => {
    const html = renderToString(
      <ProgressLog
        latestOnly
        entries={[
          { timestamp: 1, message: "one" },
          { timestamp: 2, message: "two" },
        ]}
      />,
    );
    expect(html).toContain("two");
    expect(html).not.toContain("one");
  });

  it("renders nothing when entries empty", () => {
    expect(renderToString(<ProgressLog entries={[]} />)).toBe("");
  });
});
