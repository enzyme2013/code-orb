# Release Workflow

## Purpose

This document defines the default workflow for planning, executing, validating, and closing out Code Orb release milestones.

It is the canonical execution workflow for milestone work. Use it together with:

- `docs/roadmap/roadmap.md` for version sequencing
- `docs/roadmap/releases/<version>.md` for release intent and scope
- `docs/roadmap/releases/<version>-checklist.md` for execution order and review tracking
- `docs/engineering/testing.md` for validation layers
- `docs/adr/` and `docs/architecture/` when milestone work changes cross-cutting behavior

## Summary

Use this sequence for each release milestone:

- `A -> Define version goal`
- `B -> Break it into an execution checklist`
- `C -> Implement in dependency order and validate as work lands`
- `D1 -> Triage acceptance findings and assign version ownership`
- `D2 -> Close out, verify exit criteria, and publish release status`

## Canonical Release Artifacts

Each meaningful release milestone should have a small, explicit document set:

- `docs/roadmap/releases/<version>.md`
  - defines `intent`, `in scope`, `out of scope`, `exit criteria`, and `validation strategy`
- `docs/roadmap/releases/<version>-checklist.md`
  - defines execution order, task packages, dependencies, and acceptance criteria
- `docs/adr/*.md`
  - records hard-to-reverse decisions introduced by the release
- matching docs under `docs/architecture/`
  - reflect the architecture that the implementation now depends on
- tests and benchmarks under `tests/` and `benchmarks/`
  - prove the milestone behavior rather than only describing it

The release doc defines what the milestone is.

The checklist defines how the milestone will be executed and reviewed.

## A -> Define Version Goal

Before substantial implementation work starts:

1. confirm where the milestone sits in `docs/roadmap/roadmap.md`
2. create or update `docs/roadmap/releases/<version>.md`
3. state the release `intent`
4. lock `in scope` and `out of scope`
5. define explicit `exit criteria`
6. define the initial `validation strategy`

This step exists to stop scope drift before code changes begin.

At this stage, the release doc should answer:

- what capability this release adds or clarifies
- what adjacent releases own instead
- what must be true before the release can be called complete
- which benchmarks or runtime paths matter most for validation

## B -> Break It Into An Execution Checklist

Before broad implementation, create `docs/roadmap/releases/<version>-checklist.md`.

The checklist is the execution and review baseline for the release. For `0.x` milestones, prefer checklist-driven execution over ad hoc todo notes.

Break the release into ordered task packages, usually using `P0`, `P1`, and `P2`.

For each task package, record:

- `Goal`
- `Dependencies`
- `Tasks`
- `Suggested files`
- `Acceptance criteria`

The default ordering rule is:

1. contracts and boundaries
2. runtime wiring and implementation
3. tests, benchmarks, and doc closeout

If the release changes cross-cutting behavior, put the contract and architecture work before the broader implementation work. Do not let implementation accidentally define the boundary.

## C -> Implement In Dependency Order

Execute the checklist from higher-leverage boundary work toward lower-level implementation detail.

Use this order when a task touches multiple concerns:

1. product scope
2. architecture
3. package boundaries
4. implementation details

During implementation:

- update the checklist as task packages land
- update the release doc when status, execution notes, or scope clarifications change
- update architecture docs in the same patch when runtime behavior changes
- add or update an ADR when the release changes a decision that is expensive to reverse
- keep the diff aligned with the active task package instead of mixing unrelated release work

For milestone work, validation should land with the implementation rather than waiting until the very end.

## Validation During Implementation

Each task package should add the smallest honest validation that proves the new behavior.

Default validation layers:

- `unit tests`
  - required for pure logic, parsers, normalization, schemas, policy decisions, classification rules, and other narrow runtime contracts
- `integration tests`
  - required when behavior crosses core runtime boundaries such as session flow, tool execution, provider adapters, or persistence
- `e2e tests`
  - required for CLI-visible behavior and realistic fixture-repository flows
- `benchmarks`
  - required for milestone capability paths and regression guarding on the release's most important end-to-end scenarios
- `manual smoke tests`
  - required when the behavior depends on a real TTY, real provider, or another path that automated coverage does not faithfully exercise
- `manual execution tests`
  - required in final acceptance when the release claims a user-facing CLI or runtime path that should be exercised directly outside the normal automated harness

Benchmarks are not a substitute for unit tests.

Use benchmarks to prove milestone capability and guard regressions, while unit and integration tests prove the contract details that make the milestone maintainable.

## D1 -> Triage Acceptance Findings

Acceptance and release validation often expose new problems late in the milestone. Do not handle those findings informally.

Before calling the release complete, triage each meaningful finding against the current milestone boundary.

The first three questions are:

1. if this issue is not fixed, can the current release still honestly claim to satisfy its exit criteria
2. does this issue affect a flow, test, benchmark, or manual smoke path that the current release explicitly promised
3. is this issue a regression introduced by the current release work

Based on those answers, classify the finding into one of these buckets:

- `Current Release Blocker`
  - the finding blocks the current release from honestly meeting its exit criteria, or breaks a promised flow
- `Current Release Closeout Fix`
  - the finding belongs to the current release even if it was discovered late, because the release is not credibly complete without it
- `Future Release Issue`
  - the finding is real, but it does not block the current release and is not a regression that should be absorbed silently into the current milestone
- `Roadmap Split Problem`
  - the finding shows that the current milestone boundary is wrong or misleading, so roadmap or release-doc scope must be updated before implementation ownership is decided

Use these ownership rules:

- if a finding makes the current release's exit criteria, promised flow, or release claim dishonest, keep it in the current release
- if a finding is a current-release regression, keep it in the current release
- if a finding does not block the current release and is not a current-release regression, assign it to the earliest later release that can own it honestly
- if fixing the finding would materially expand current-release scope, do not absorb it silently; either defer it or explicitly re-scope the release docs

## Acceptance Finding Record

Each significant acceptance finding should be recorded in a consistent form in the release checklist, release doc, or both.

Use these fields:

- `summary`
- `found during`
- `affected flow/test/benchmark`
- `scope relation`
- `decision`
- `target version`
- `release blocking: yes/no`

If the finding remains in the current release:

- reflect it in the current release checklist
- update the release doc status or validation notes as needed
- prefer explicit release-doc sections such as `Status Clarification` or `Release Validation Status` when late findings materially affect release honesty

If the finding moves to a later release:

- record the target release explicitly
- ensure the later release doc or checklist picks it up instead of leaving it as a vague note

## Release Date Guidance

For milestones where implementation lands before closeout is complete, track dates explicitly.

When useful, distinguish between:

- `initial landing date`
- `release closeout date`

This keeps the release record honest when the main implementation lands first but final release validation or closeout fixes finish later.

## D2 -> Close Out And Publish Release Status

When the checklist implementation is complete:

1. complete acceptance triage for new findings from validation and smoke testing
2. run the intended validation set across `unit`, `integration`, `e2e`, and `benchmark` coverage as applicable
3. run at least one explicit manual execution test for the release's primary user-facing path when that path can be exercised directly
4. run required manual smoke coverage when automation is not enough
5. verify the release still satisfies its `in scope` and `out of scope` boundaries
6. verify the release meets its `exit criteria`
7. update release status with concrete dates where appropriate
8. note remaining risks and any intentionally deferred work
9. confirm the repository docs still match the implemented behavior

Release closeout should leave behind an honest record of:

- what shipped
- what was validated
- what was manually executed
- what was not validated
- what remains intentionally deferred

## Recommended Milestone Shape

For most Code Orb milestones, the practical document flow should look like this:

1. update `docs/roadmap/roadmap.md` if sequencing changed
2. create or refine `docs/roadmap/releases/<version>.md`
3. create `docs/roadmap/releases/<version>-checklist.md`
4. land implementation in checklist order
5. update `docs/architecture/` and `docs/adr/` in the same patches as cross-cutting changes
6. triage acceptance findings and assign version ownership
7. close out tests, benchmarks, and release status updates

## Workflow Rules

- do not start broad milestone implementation before the release doc and checklist exist
- do not treat a benchmark-only pass as sufficient release proof
- do not mark a release complete only because code compiles or one demo path works once
- do not leave architecture-changing behavior undocumented until a later cleanup pass
- if a milestone gets split or rescheduled, update both `docs/roadmap/roadmap.md` and the affected release docs
- do not silently absorb acceptance-time findings into the current release without deciding whether they are blockers, closeout fixes, later-release issues, or roadmap-split problems

## Exit Rule

A release milestone is complete only when its release doc, checklist, implementation, architecture notes, and validation record all agree on what shipped and why it is considered done.
