"use client";
import * as React from "react";
import type { LogEntry } from "../core/types";

export function ProgressLog(props: {
  entries: LogEntry[] | undefined;
  latestOnly?: boolean;
  limit?: number;
  className?: string;
  renderEntry?: (entry: LogEntry, i: number) => React.ReactNode;
}) {
  const { entries, latestOnly, limit = 10, className, renderEntry } = props;
  if (!entries || entries.length === 0) return null;
  const visible = latestOnly ? entries.slice(-1) : entries.slice(-limit);
  return (
    <ul data-role="progress-log" className={className}>
      {visible.map((e, i) =>
        renderEntry ? (
          <React.Fragment key={`${e.timestamp}-${i}`}>{renderEntry(e, i)}</React.Fragment>
        ) : (
          <li key={`${e.timestamp}-${i}`} data-level={e.level ?? "info"} data-phase={e.phase}>
            <time dateTime={new Date(e.timestamp).toISOString()}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </time>
            <span>{e.message}</span>
          </li>
        ),
      )}
    </ul>
  );
}
