# Phase 2: Minimal Loop

## Purpose

Build the smallest believable end-to-end coding-agent loop that exercises the runtime contracts defined in Phase 1.

This phase is still part of `0.1.0`.

## Minimum Acceptance Target

The first acceptable Phase 2 result is:

- `orb run "<task>"` can run against one small fixture repository
- the runtime can inspect repository context, make at least one code or doc change, run one verification command, and produce a final report
- CLI output is driven by structured runtime events rather than ad hoc logs

This is intentionally smaller than a generally useful coding agent. The goal is to prove one honest end-to-end loop.

## Scope

- wire the CLI entry point to the core runtime
- support one local repository task flow from prompt to report
- implement the minimum useful tools:
  - list files
  - read file
  - search text
  - apply patch or equivalent write path
  - run command
- route mutating tool calls through the minimum safety gate
- emit the minimum event stream needed for rendering and tests
- run on fixture repositories

## Out Of Scope

- multi-agent execution
- background daemon mode
- dynamic skills
- advanced provider routing
- large plugin surfaces

## Exit Criteria

- `orb run "<task>"` can operate on a fixture repository
- the system can read, edit, verify, and report in one foreground session
- CLI rendering is driven by structured events rather than ad hoc logs
- the implementation still respects the documented layer boundaries

## Review Baseline

Use [phase-2-checklist.md](./phase-2-checklist.md) as the concrete review and execution baseline for this phase.
