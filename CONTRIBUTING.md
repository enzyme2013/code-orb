# Contributing

This repository is in an early bootstrap phase. Contributions should optimize for clarity, reversibility, and architectural coherence.

## Before You Change Things

- Read [AGENTS.md](./AGENTS.md).
- Read the relevant product and architecture docs.
- Check whether the change should be captured in an ADR.

## Contribution Expectations

- Keep changes narrow and explain the intended outcome.
- Update docs in the same patch when changing behavior, structure, or policy.
- Prefer incremental scaffolding over speculative framework build-out.
- Avoid introducing new top-level directories without updating the architecture docs.

## Validation

Until the toolchain is fully wired, every change report should state:

- what was validated
- what could not be validated yet
- which risks remain

## Commit Style

Conventional commits are recommended, for example:

- `docs: define initial architecture docs`
- `feat(cli): add bootstrap command entry`
- `refactor(core): split tool registry from executor`
