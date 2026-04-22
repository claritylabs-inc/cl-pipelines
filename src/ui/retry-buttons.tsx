"use client";
import * as React from "react";

export type RetryMode = "resume" | "full";

export function RetryButtons(props: {
  onRetry: (mode: RetryMode) => void;
  disabled?: boolean;
  labels?: { resume?: string; full?: string };
  renderButton?: (
    mode: RetryMode,
    onClick: () => void,
    label: string,
    disabled: boolean,
  ) => React.ReactNode;
  className?: string;
}) {
  const { onRetry, disabled, labels, renderButton, className } = props;
  const resumeLabel = labels?.resume ?? "Retry";
  const fullLabel = labels?.full ?? "Restart";
  const render =
    renderButton ??
    ((mode, onClick, label, d) => (
      <button type="button" onClick={onClick} disabled={d} data-retry-mode={mode}>
        {label}
      </button>
    ));
  return (
    <div data-role="retry-buttons" className={className}>
      {render("resume", () => onRetry("resume"), resumeLabel, !!disabled)}
      {render("full", () => onRetry("full"), fullLabel, !!disabled)}
    </div>
  );
}
