# Execution Model

## Default Model

The initial execution model is a single-process CLI runtime. One user request maps to one foreground session.

This is a deliberate simplification so that the project can validate the agent loop before introducing daemons, background workers, or multi-agent scheduling.

## Session Lifecycle

Each session should move through these phases:

1. bootstrap
2. context gathering
3. planning
4. tool execution and edits
5. verification
6. final report

## Retry Behavior

Retries should be explicit and bounded. The system should avoid invisible loops that keep mutating the repository without a clear stopping condition.

Initial policy:

- one task owns one working session
- retries are recorded as events
- verification failures should feed back into the session state
- hard stops should happen when safety policy denies the next step

## Why Not A Daemon Yet

A daemon can improve responsiveness and state reuse later, but it introduces lifecycle management, client/server contracts, and new failure modes. Those costs are not justified until the core loop is stable.

## Evolution Path

If a local daemon is introduced later, it should preserve:

- the same logical session lifecycle
- the same event protocol
- the same tool contracts where possible

Only the hosting model should change, not the product semantics.
