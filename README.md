# CL-Pipelines

Durable execution primitives for deterministic agents and regulated workflows. Typed checkpoints, resume/full retry, Convex adapter, headless UI.

**[Documentation](https://claritylabs.inc/docs/pipelines)** | **[npm](https://www.npmjs.com/package/@claritylabs/cl-pipelines)** | **[GitHub](https://github.com/claritylabs-inc/cl-pipelines)**

## Installation

```bash
npm install @claritylabs/cl-pipelines
```

## Quickstart

```typescript
import type { Phase } from "@claritylabs/cl-pipelines";
import {
  runPipeline,
  advancePhase,
  createMemoryStorage,
  createMemoryScheduler,
} from "@claritylabs/cl-pipelines";

type CounterState = { count: number };

const countUp: Phase<CounterState> = {
  name: "countUp",
  run: async (ctx) => {
    const { count } = ctx.checkpoint.state;
    await ctx.log(`count is ${count}`);
    return { kind: "next", nextPhase: "logDone", state: { count: count + 1 } };
  },
};

const logDone: Phase<CounterState> = {
  name: "logDone",
  run: async (ctx) => {
    await ctx.log(`done, count = ${ctx.checkpoint.state.count}`);
    return { kind: "done" };
  },
};

const phases = [countUp, logDone];
const storage = createMemoryStorage<CounterState>();
const scheduler = createMemoryScheduler();

scheduler._bind((jobId) => advancePhase({ jobId, phases, storage, scheduler }));

await runPipeline({ jobId: "job-1", phases, storage, scheduler, initialState: { count: 0 } });
await scheduler.drain();

const job = storage._inspect().get("job-1")!;
console.log(job.status); // "complete"
```

## Subpath Exports

| Subpath | Contents | Peer deps |
|---|---|---|
| `@claritylabs/cl-pipelines` | Core phase runner, agent primitive, memory adapters | `zod >=3.22` |
| `@claritylabs/cl-pipelines/convex` | Convex storage + scheduler adapters, schema builder | `convex >=1.17`, `zod >=3.22` |
| `@claritylabs/cl-pipelines/ui` | Headless React UI primitives | `react >=18` |

## When to Use

- Durable long-running jobs that must survive process restarts and partial failures.
- Deterministic agent loops (LLM + tools + reviewable state) where each turn is checkpointed and can be retried independently.
- Multi-phase pipelines with explicit checkpoint boundaries, typed state, and resume/full retry modes.

## Docs

Full documentation at **[claritylabs.inc/docs/pipelines](https://claritylabs.inc/docs/pipelines)**.

## License

Apache-2.0
