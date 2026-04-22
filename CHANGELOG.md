# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-22

### Added
- Phase runner (`runPipeline`, `advancePhase`) with typed `Checkpoint<TState>` and resume/full retry modes.
- Agent primitive (`runAgent`, `buildAgentPhase`) on top of the phase runner, using AI SDK v6 `LanguageModelV2` and `ToolSet`.
- In-memory adapters (`createMemoryStorage`, `createMemoryScheduler`) for tests.
- Convex adapter (`/convex` subpath): `pipelineFields()` schema builder, `createConvexStorageAdapter`, `createConvexSchedulerAdapter`.
- Headless UI primitives (`/ui` subpath): `StatusBanner` compound component, `ProgressLog`, `RetryButtons`.
- Documentation package `@claritylabs/cl-pipelines-docs` with MDX content matching cl-sdk's docs format.
