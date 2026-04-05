# Phase 1 Checklist

## Purpose

This checklist is the review baseline for deciding whether Phase 1 is actually complete.

It should be used after implementation and documentation updates are in place. It is intentionally more concrete than the roadmap summary so contributors can review the work item by item.

## Architecture And Boundaries

- [x] The shell, core runtime, and adapter / execution harness split is clearly documented.
- [x] The layer diagram in `docs/architecture/overview.md` matches the current intended structure.
- [x] The dependency direction between shell, core, contracts, adapters, and shared utilities is explicit.
- [x] The role of provider adapters is documented as infrastructure rather than core semantics.
- [x] Future multi-provider support is not blocked by the current contracts.

## Runtime Model

- [x] `Session`, `Turn`, and `Step` are defined with non-overlapping meanings.
- [x] The runtime lifecycle for session, turn, and step is documented.
- [x] Turn-scoped planning is represented as structured plan / todo items rather than plain strings.
- [x] The difference between user-facing turn boundaries and internal step boundaries is explicit.

## Tool, Policy, And Event Contracts

- [x] Tool contracts are defined separately from tool execution backends.
- [x] The split between `Agent Engine` and `Tool Executor` is reflected in both docs and code structure.
- [x] Policy, permission decisions, and approval responses are distinguished clearly.
- [x] The minimum event catalog is defined and treated as runtime infrastructure.
- [x] Event payloads are structured enough to support CLI rendering and test assertions.

## Schemas And Ports

- [x] `packages/schemas` contains stable contracts for runtime, events, tools, policy, model, report, and config.
- [x] `packages/core` exposes explicit ports for session running, agent execution, tool execution, policy, events, and model access.
- [x] Core contracts do not directly depend on a provider-specific SDK shape.
- [x] The current contract surface is small enough to evolve without large rewrites.

## Minimal Runtime Skeleton

- [x] A minimal session runner exists and can create session and turn state.
- [x] A minimal agent engine exists and can create at least one step and produce a turn report.
- [x] A basic event sink exists and can capture emitted runtime events.
- [x] The minimal runtime skeleton works without requiring real tools or a real provider.
- [x] Success and failure paths both produce coherent event behavior.

## CLI Contract

- [x] The `orb run` command surface exists at the contract level.
- [x] CLI argument parsing can produce a valid `SessionInput`.
- [x] Help and invalid-command behavior are defined.
- [x] The CLI command surface does not bypass core contracts.

## Tests

- [x] The default test runner is documented and configured.
- [x] Unit tests cover schema and contract expectations.
- [x] Integration tests cover the minimum runtime skeleton and emitted event flow.
- [x] The Phase 1 test suite can run locally with standard project setup.

## Scope Discipline

- [x] Phase 1 does not depend on subagents, dynamic skills, daemon mode, or desktop UI.
- [x] Phase 1 does not introduce advanced provider routing as a required capability.
- [x] The implementation still fits the intended role of Phase 1: runtime contracts first, full product loop later.

## Exit Rule

Phase 1 should be considered complete only when the checklist can be reviewed item by item and the answer is "yes" without relying on unstated context.
