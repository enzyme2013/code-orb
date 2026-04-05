# Code Orb

Code Orb is a CLI-first coding agent project with a future path to desktop.

The repository is currently in a docs-first bootstrap phase. The immediate goal is to define the engineering frame clearly enough that human contributors and coding agents can build the product without re-litigating basic structure on every task.

## Current Priorities

- Establish a single source of truth for agent-facing development guidance.
- Define the initial repository layout and architectural boundaries.
- Set versioning and roadmap rules before implementation accelerates.

## Read First

- [AGENTS.md](./AGENTS.md)
- [docs/product/vision.md](./docs/product/vision.md)
- [docs/product/v0-scope.md](./docs/product/v0-scope.md)
- [docs/architecture/overview.md](./docs/architecture/overview.md)
- [docs/roadmap/roadmap.md](./docs/roadmap/roadmap.md)

## Repository Layout

```text
apps/         App entry points such as the CLI and, later, desktop shells.
packages/     Shared runtime packages used by multiple apps.
docs/         Product, architecture, ADR, roadmap, engineering, and reference docs.
prompts/      Prompt assets managed as first-class project artifacts.
tests/        Unit, integration, end-to-end, and fixture repositories.
scripts/      Automation scripts that support development and release work.
```

## Working Style

- `AGENTS.md` is the canonical guide for coding agents working in this repository.
- `CLAUDE.md` is intentionally thin and points back to `AGENTS.md`.
- Architecture changes should update the relevant docs in the same patch.
- ADRs are used for decisions that would be expensive to reverse later.
