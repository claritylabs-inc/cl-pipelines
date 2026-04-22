"use client";
import * as React from "react";
import type { PipelineStatus, LogEntry } from "../core/types";

type BannerContext = {
  status: PipelineStatus | undefined;
  error: string | undefined;
  log: LogEntry[] | undefined;
};

const Ctx = React.createContext<BannerContext | null>(null);

function useBanner(component: string): BannerContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error(`${component} must be rendered inside <StatusBanner.Root>`);
  return ctx;
}

function defaultTitle(s: PipelineStatus): string {
  return s === "running" ? "Running…"
    : s === "error" ? "Error"
    : s === "paused" ? "Paused"
    : "";
}

export function StatusBannerRoot(props: {
  status: PipelineStatus | undefined;
  error?: string;
  log?: LogEntry[];
  children: React.ReactNode;
  className?: string;
}) {
  const { status, error, log, children, className } = props;
  if (!status || status === "idle" || status === "complete") return null;
  return (
    <Ctx.Provider value={{ status, error, log }}>
      <div role="status" data-status={status} className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function StatusBannerIndicator(props: {
  className?: string;
  render?: (status: PipelineStatus) => React.ReactNode;
}) {
  const ctx = useBanner("StatusBanner.Indicator");
  if (props.render && ctx.status) return <>{props.render(ctx.status)}</>;
  return <span data-indicator={ctx.status} className={props.className} aria-hidden />;
}

export function StatusBannerTitle(props: {
  children?: React.ReactNode;
  className?: string;
}) {
  const ctx = useBanner("StatusBanner.Title");
  return (
    <div data-role="title" className={props.className}>
      {props.children ?? (ctx.status ? defaultTitle(ctx.status) : null)}
    </div>
  );
}

export function StatusBannerDescription(props: {
  children?: React.ReactNode;
  className?: string;
}) {
  const ctx = useBanner("StatusBanner.Description");
  return (
    <div data-role="description" className={props.className}>
      {props.children ?? ctx.error ?? null}
    </div>
  );
}

export function StatusBannerActions(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div data-role="actions" className={props.className}>{props.children}</div>;
}

export const StatusBanner = Object.assign(StatusBannerRoot, {
  Root: StatusBannerRoot,
  Indicator: StatusBannerIndicator,
  Title: StatusBannerTitle,
  Description: StatusBannerDescription,
  Actions: StatusBannerActions,
});
