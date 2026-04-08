# Tool System

## Goal

Tools are how the agent interacts with the repository and runtime environment. The tool system should be typed, auditable, and easy to extend without letting side effects become ambiguous.

## Layering

Tools span three boundaries:

- contracts live in `packages/schemas`
- execution semantics live in `packages/core`
- concrete backends live in the adapter / execution harness layer

This means a tool is not just a function pointer. A tool is a contract plus runtime behavior plus a backend that touches the real world.

## Initial Tool Categories

- repository context: read file, list files, search text
- editing: write file, apply patch
- execution: run command
- git-aware helpers: diff, status, branch awareness
- session helpers: checkpoint, notes, report artifacts

## Design Rules

- Every tool has a stable name and schema-defined input and output.
- Tools must declare whether they are read-only or side-effecting.
- Tools must declare the approval path they require.
- Tools that may be exposed to model-native tool calling should declare a model-facing input schema.
- Tool execution should produce a canonical runtime-owned result before any provider-specific wire encoding is applied.
- Side-effecting tools should return enough metadata to support audit trails.
- Tool calls should be visible in the session event stream.
- Tools should do one thing well instead of exposing large ambiguous surfaces.
- file-editing tools may create a new repository file when the request is explicit and auditable rather than inferring hidden side effects
- built-in tool registration should be a runtime-owned concern rather than only executor-local hardcoding
- tool lookup, validation, dispatch, and backend execution should stay conceptually distinct even when one implementation owns several of them early on

## Boundary

Tool contracts belong to `packages/schemas`. Tool implementations belong to `packages/core`.

The CLI may render tool activity, but it should not redefine tool semantics.

More precisely:

- the `Turn Query Loop` decides whether tool work is required
- the runtime-owned tool registry decides which tool definitions are available
- the `Tool Orchestrator` exposes the active tool definitions to runtime consumers and decides how tool work is validated, grouped, and interpreted
- the `Tool Executor` decides how one concrete tool request is executed
- adapters perform the actual side effect

This separation prevents the tool layer from silently turning into a second planner.

## 0.6 Tool Runtime Baseline

`0.6.0` should make the minimum tool-runtime contract explicit before `0.7.0` adds broader orchestration.

That baseline is:

1. registration
   - the runtime owns the available tool definitions
2. lookup
   - unknown-tool behavior is explicit and observable
3. validation
   - input shape and execution expectations are checked before the backend runs
4. policy routing
   - allow, confirm, or deny decisions happen before side effects
5. execution
   - the backend performs the effect or data lookup
6. metadata and events
   - results include enough metadata for auditability and later orchestration

`0.6.0` does not require a full dynamic plugin ecosystem.

It does require built-in tools to stop pretending that hardcoded executor-local definitions are the only meaningful registration shape.

## 0.7 Tool Runtime Shape

`0.7.0` extends the baseline into a loop-aware tool runtime:

1. availability
   - the executor can surface the active tool definitions through the same runtime-owned registration boundary used for execution
   - model-facing tool availability is derived from the same registrations rather than an adapter-local shadow catalog
2. invocation
   - a concrete tool call still routes through validation, policy, backend execution, and events
3. normalized outcomes
   - runtime consumers can distinguish:
     - success
     - denied
     - cancelled
     - invalid input
     - unknown tool
     - other execution failure
4. loop re-entry
   - tool results can re-enter turn state directly, including model follow-up flows when provider capability allows it

This keeps the runtime from depending on thrown exceptions or CLI-local assumptions to understand what happened during tool execution.

For provider-native tool calling, the adapter may translate the runtime-owned `inputSchema` into the provider's function-parameter descriptor, but the source definition still belongs to the runtime registration boundary.

## Tool Orchestrator Boundary

For the intended `0.7.0` runtime skeleton, tool orchestration is distinct from both the turn loop and the concrete executor.

The `Tool Orchestrator` should own:

- which tools are available for this turn
- how tool calls are validated before execution
- how read-only versus mutating calls are grouped or serialized
- how policy and approval decisions are integrated
- how raw execution outcomes become canonical runtime-owned tool results

The `Tool Executor` should remain narrower:

- execute one requested tool call
- return execution metadata and raw success or failure
- emit execution events

Early implementations may colocate part of this behavior, but the architectural distinction should remain explicit.

## Generated Edit Execution

Assistant-produced edits should be treated as runtime edit semantics, not as shell presentation behavior.

For `0.6.0`, the important distinction is between:

- generated create
- generated rewrite
- targeted replacement

These may still share implementation pieces, but they should be distinguishable in runtime reasoning, reporting, and event or metadata surfaces.

When path selection for a generated edit is not explicit in the user task, the runtime should keep the path source auditable, for example:

- requested directly by the task
- suggested explicitly by assistant output
- inferred by a bounded runtime heuristic

## Safety Integration

Tool execution must route through the safety model. The tool layer is not allowed to bypass confirmation or denial policy just because a tool implementation can technically do so.

The minimum execution path is:

```text
Agent Engine
  -> Tool Executor
  -> Policy Engine
  -> Tool Backend / Adapter
  -> Event Stream
```

## Future Extension

Future external tool providers or plugin-based tools should still conform to the same contract shape and event semantics documented now.

## V0.4 Session And Git Context

`0.4.0` adds two runtime adapters adjacent to the existing tool path:

- a local session store for persisted session artifacts
- a git state reader for working-tree snapshots

These are runtime support components, not user-invoked tools. They do not appear as agent tool calls, but they do feed artifact generation and final reporting.

This distinction matters:

- agent-facing tools remain the mechanism for reading, editing, and executing within the repository
- session persistence and git snapshotting are runtime-owned observations used for auditability and continuity

The CLI may render these observations, but the source of truth remains the runtime artifact and report contracts.
