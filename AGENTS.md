# AGENTS.md

This file is the canonical contributor guide for coding agents working on Code Orb.

If another agent-specific file duplicates guidance from here, this file wins. Agent-specific files should stay thin and defer back to this document whenever possible.

## Project Intent

Code Orb is being built as a CLI-first coding agent for local repositories, with a future path to a desktop application. The project is intentionally starting with a clean repository so that the architecture, operating rules, and version plan are explicit before implementation grows.

## Source Of Truth

- Repository-wide working rules live in this file.
- Product intent lives under `docs/product/`.
- System design lives under `docs/architecture/`.
- durable decision records live under `docs/adr/`.
- release sequencing lives under `docs/roadmap/`.
- reference material and agent-authored analysis live under `docs/reference/`.

Do not introduce parallel rulebooks in random markdown files. If a new rule affects all contributors or all coding agents, put it here or link to the right document from here.

## Expected Working Pattern

When taking on a task in this repository:

1. Read the task request.
2. Read `AGENTS.md`.
3. Read the most relevant scoped docs before making design changes.
4. Keep the diff focused on the requested outcome.
5. Update docs in the same change if behavior, structure, or policy changes.

For early-stage architectural work, the minimum context is usually:

- `README.md`
- `docs/product/v0-scope.md`
- `docs/architecture/overview.md`
- the relevant ADRs

## Collaboration Protocol

When acting as a coding agent in this repository:

- Restate the requested change before substantial work.
- Surface assumptions early, especially if they affect architecture or scope.
- Keep progress updates concise and concrete.
- Report blockers immediately instead of silently stalling.
- End with changed files, validation status, and notable risks or follow-ups.
- Do not ask for permission to continue implementation with phrases such as `如果你要，我下一步可以...`, `如果你要我继续...`, `如果你愿意...`, `你要我直接...吗?`, `要不要我帮你...`, `是否需要我...`, `我可以帮你...，要我做吗?`, or offer-style `下一步可以...` wording. State the next concrete action directly and execute it unless the user explicitly asked to pause, choose, or confirm.

When a task affects multiple concerns, use this order:

1. Product scope
2. Architecture
3. Package boundaries
4. Implementation details

This order matters because implementation should reflect established boundaries rather than define them accidentally.

## Documentation Rules

- `README.md` is the repository entry point, not the full design spec.
- `AGENTS.md` defines agent-facing repo rules.
- `docs/product/` defines what the product is and is not.
- `docs/architecture/` defines how the system is intended to work.
- `docs/adr/` records major decisions and why they were made.
- `docs/roadmap/` defines version sequencing and milestone scope.
- `docs/engineering/` covers operational practices such as testing and release work.
- `docs/reference/` stores supporting material such as external references and coding-agent analysis notes.
- use repository-relative paths in markdown links and examples unless an absolute path is explicitly required for the task.
- do not commit machine-specific absolute paths, usernames, home directories, or workspace locations in docs or templates.

Do not copy large chunks of one document into another. Link instead.

`docs/reference/` is supporting context, not the source of truth for product scope, architecture, or policy. If a reference note changes how the system should work, update the authoritative doc as well.

## When To Add An ADR

Add or update an ADR when changing any of the following:

- primary language or runtime
- package or workspace structure
- execution model
- safety or permission model
- persistence strategy
- extension or plugin model
- public configuration shape
- event or tool protocol shape

If a decision is expensive to reverse and likely to be discussed again, it should probably be an ADR.

## Architecture Update Rule

If a change alters cross-cutting behavior, update the matching architecture doc in the same patch. Examples:

- tool lifecycle changes -> `docs/architecture/tool-system.md`
- agent loop changes -> `docs/architecture/execution-model.md`
- permission behavior changes -> `docs/architecture/safety-model.md`
- event shape changes -> `docs/architecture/protocols/events.md`

## Repository Shape

The intended repository shape is:

```text
apps/
  cli/
benchmarks/
packages/
  core/
  schemas/
  shared/
docs/
prompts/
tests/
scripts/
```

New top-level directories should be rare. If one is needed, update the architecture docs and explain why.

## Implementation Bias

The default implementation bias for now is:

- TypeScript + Node.js for orchestration and product velocity
- external tools or subprocesses for heavy work
- clear package boundaries over early cleverness
- single-process CLI before daemon or multi-agent designs

If you want to move against this bias, record the reason explicitly.

## Definition Of Done

A change is not done just because code compiles. Before considering a task complete:

- update the docs that the change invalidated
- note what validation was run
- note what was not validated
- keep the repository structure coherent with the documented plan

## Current Status

The repository is still in bootstrap. Many commands and workflows are placeholders. If tooling is missing, prefer adding the smallest viable scaffold instead of inventing a full production stack prematurely.
