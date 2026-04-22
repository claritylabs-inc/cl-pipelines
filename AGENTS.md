# AGENTS.md

This file provides guidance to coding agents working with code in this repository.

## Overview

`@claritylabs/cl-pipelines` is a runtime-agnostic library for long-running jobs and agent primitives. It provides a typed, schedule-and-advance phase runner with explicit checkpoint boundaries, resume/full retry modes, an LLM agent loop built on AI SDK v6 `LanguageModelV2`, a Convex adapter, and headless React UI primitives. Zero framework dependencies in core; adapters and UI are opt-in via subpath exports.

## Commands

```bash
npm run build      # Build ESM + CJS + types via tsup
npm run dev        # Watch mode (tsup --watch)
npm run typecheck  # Type check only (tsc --noEmit && tsc --noEmit -p tsconfig.test.json)
npm test           # Run vitest
```

## Architecture

### File Structure

```
src/
  core/           # Phase runner (runPipeline, advancePhase), typed Checkpoint, retry logic, errors, core types
  agent/          # LLM agent primitive (runAgent, buildAgentPhase) on top of the phase runner
  adapters/       # Adapter interfaces + in-memory implementations (createMemoryStorage, createMemoryScheduler)
  convex/         # Convex storage + scheduler adapters, pipelineFields() schema builder
  ui/             # Headless React primitives: StatusBanner, ProgressLog, RetryButtons
__tests__/        # Vitest unit and integration tests; mirrors src/ structure
docs-pkg/         # MDX documentation source shipped as @claritylabs/cl-pipelines-docs
```

### Phase Runner (`src/core/`)

The phase runner implements a schedule-and-advance pattern. `runPipeline` initialises a job checkpoint and schedules the first phase. `advancePhase` is called by the scheduler for each phase transition. Phase results are one of `next`, `done`, or `error`. Retry mode (`resume` | `full`) is stored on the checkpoint and controls whether the next attempt reuses the last good state or restarts from `initialState`.

Entry points: `runPipeline(args)`, `advancePhase(args)`.

### Agent Primitive (`src/agent/`)

`runAgent` wraps an LLM tool loop on top of `runPipeline`. Each tool-call turn is checkpointed. `buildAgentPhase` produces a `Phase` that can be composed into a larger pipeline. The agent is provider-agnostic via AI SDK v6's `LanguageModelV2` and `ToolSet` interfaces.

### Adapters (`src/adapters/`)

`StorageAdapter` and `SchedulerAdapter` are the two interfaces consumed by the phase runner. The memory implementations (`createMemoryStorage`, `createMemoryScheduler`) are suitable for tests and local development. `scheduler._bind` and `storage._inspect` are test-only escape hatches.

### Convex Adapter (`src/convex/`)

`pipelineFields()` returns the Convex schema fields required to store a pipeline job. `createConvexStorageAdapter` and `createConvexSchedulerAdapter` produce adapter instances backed by Convex mutations, queries, and scheduled functions. Import from the `/convex` subpath.

### UI Primitives (`src/ui/`)

Headless compound components with no built-in styles. `StatusBanner` exposes Root/Indicator/Title/Description/Actions slots. `ProgressLog` renders a scrollable log of phase output. `RetryButtons` surfaces resume/full retry actions. Import from the `/ui` subpath.

## Playbooks

### Adding a new phase type / result kind

1. Extend `PhaseResult` union in `src/core/types.ts`.
2. Handle the new case in the `advancePhase` switch in `src/core/phase-runner.ts`.
3. Add a test in `__tests__/core/`.
4. Update `docs-pkg/phase-runner/` with the new result kind.

### Adding a new adapter

1. Implement `StorageAdapter<TState>` and/or `SchedulerAdapter` from `src/core/types.ts`.
2. Place the implementation under `src/adapters/<name>.ts`.
3. Re-export from `src/adapters/index.ts` if it belongs in core; otherwise expose it as a new subpath in `package.json` and `tsup.config.ts`.
4. Add integration tests in `__tests__/adapters/`.

### Adding a UI primitive

1. Create a `.tsx` file under `src/ui/`.
2. Re-export from `src/ui/index.ts`.
3. Keep all styling decisions in the consumer — primitives expose only structure and callbacks.
4. Add a test in `__tests__/ui/` using a headless renderer (no DOM dependency in core test suite).

## Docs Package

`docs-pkg/` contains MDX source files. They are published as a separate npm package `@claritylabs/cl-pipelines-docs` and consumed by `clarity-landing` to render the documentation site at `claritylabs.inc/docs/pipelines`. The package has its own `docs-pkg/package.json` and versioning that tracks the main package version. Keep `docs-pkg/changelog.mdx` in sync with `CHANGELOG.md`.

## Release

Releases are automated via `scripts/release.sh` (added in Task 12). The script bumps the version, updates `CHANGELOG.md` and `docs-pkg/changelog.mdx`, builds, and publishes both the main package and the docs package. Tag format: `v<semver>`.

## Contributing

Commit message conventions match cl-sdk:

- `feat(scope): …` — new user-facing feature
- `fix(scope): …` — bug fix
- `refactor(scope): …` — internal restructure, no behaviour change
- `docs(scope): …` — documentation only
- `test(scope): …` — test additions or fixes
- `chore(scope): …` — tooling, deps, build config

Scope is one of: `core`, `agent`, `adapters`, `convex`, `ui`, `docs`, `release`.

Keep commits atomic. One logical change per commit. PRs targeting `main` require a passing typecheck and test suite before merge.
