# ADR 0002: PNPM Workspace Layout With Apps And Packages

- Status: Accepted
- Date: 2026-04-05

## Context

The project expects at least one app shell now and likely more later. A flat single-package repository would hide boundaries that matter for future CLI and desktop reuse.

## Decision

Use a workspace layout with:

- `apps/` for app shells
- `packages/` for reusable runtime modules

Use `pnpm-workspace.yaml` to define the workspace.

## Consequences

### Positive

- clearer ownership and dependency boundaries
- easier reuse of core packages across multiple shells
- simpler path to future desktop packaging without moving code later

### Negative

- slightly more initial setup than a single-package repository
- contributors must be disciplined about package boundaries
