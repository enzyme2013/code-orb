# Tool System

## Goal

Tools are how the agent interacts with the repository and runtime environment. The tool system should be typed, auditable, and easy to extend without letting side effects become ambiguous.

## Initial Tool Categories

- repository context: read file, list files, search text
- editing: write file, apply patch
- execution: run command
- git-aware helpers: diff, status, branch awareness
- session helpers: checkpoint, notes, report artifacts

## Design Rules

- Every tool has a stable name and schema-defined input and output.
- Tools must declare whether they are read-only or side-effecting.
- Side-effecting tools should return enough metadata to support audit trails.
- Tool calls should be visible in the session event stream.
- Tools should do one thing well instead of exposing large ambiguous surfaces.

## Boundary

Tool contracts belong to `packages/schemas`. Tool implementations belong to `packages/core`.

The CLI may render tool activity, but it should not redefine tool semantics.

## Safety Integration

Tool execution must route through the safety model. The tool layer is not allowed to bypass confirmation or denial policy just because a tool implementation can technically do so.

## Future Extension

Future external tool providers or plugin-based tools should still conform to the same contract shape and event semantics documented now.
