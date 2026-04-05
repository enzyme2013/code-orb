# Architecture Overview

## Purpose

This document defines the intended high-level shape of Code Orb so implementation can evolve without the core boundaries drifting.

## Layers

```text
apps/cli          User-facing command surface and terminal presentation
packages/core     Agent loop, tool execution, session state, safety, patch flow
packages/schemas  Shared schemas for events, tools, and configuration
packages/shared   Small shared utilities and types with no product policy
```

## Runtime Flow

The intended runtime flow is:

1. CLI receives a task and runtime options.
2. CLI creates a session and hands execution to `packages/core`.
3. Core gathers context, plans, invokes tools, applies edits, and runs verification.
4. Core emits structured events defined in `packages/schemas`.
5. CLI renders progress and the final report to the terminal.

## Boundary Rules

- `apps/cli` should not own business logic that future shells also need.
- `packages/core` owns agent behavior and tool orchestration.
- `packages/schemas` owns stable cross-boundary shapes.
- `packages/shared` must stay small and generic; it is not a dumping ground.

## Future Extension Path

Desktop support should add a new app shell that consumes the same core runtime and schemas. If desktop requires duplicating core behavior from the CLI, the boundary is wrong.

## Related Docs

- [execution-model.md](./execution-model.md)
- [tool-system.md](./tool-system.md)
- [safety-model.md](./safety-model.md)
- [events.md](./protocols/events.md)
- [tool-contracts.md](./protocols/tool-contracts.md)
- [config-schema.md](./protocols/config-schema.md)
