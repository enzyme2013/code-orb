# Roadmap

## Versioning Policy

- `0.0.x` is for internal bootstrap and scaffolding.
- `0.1.0` is the first end-to-end demonstrable CLI milestone.
- `0.x` minor releases should represent real capability milestones, not arbitrary time slices.
- `1.0.0` is reserved for a stable CLI contract and core protocol surface.

## Milestones

### 0.1.0 Foundation

- runtime contracts for session, turn, step, tools, policy, and events
- a minimal runnable CLI loop on fixture repositories
- repository read, edit, and verify path with a safety gate
- clear shell/core/adapter boundaries that can support later shells and providers

Current status:

- released on 2026-04-05

This milestone is expected to progress through two phases:

- Phase 1: runtime contracts and architectural hardening
- Phase 2: minimal end-to-end runnable loop

Phase detail:

- [phase-1-runtime-contracts.md](./phases/phase-1-runtime-contracts.md)
- [phase-2-minimal-loop.md](./phases/phase-2-minimal-loop.md)

Release detail: [releases/0.1.0.md](./releases/0.1.0.md)

### 0.2.0 Runnable Alpha

- make the CLI runnable and understandable for real local-repository usage
- broaden task handling beyond the current narrow replacement-oriented MVP path
- improve repository understanding, planning, and tool selection
- strengthen approval UX, reporting, and fixture coverage for real alpha usage
- use `benchmarks/failing-test-fix/` as the primary validation target

Current status:

- repository milestone achieved in the working tree
- release/version decision still pending

Release detail: [releases/0.2.0.md](./releases/0.2.0.md)
- checklist: [releases/0.2.0-checklist.md](./releases/0.2.0-checklist.md)

### 0.3.0 Edit And Verify

- more robust patch flow
- verification loops and clearer failure handling
- structured final report improvements

### 0.4.0 Session And Git Awareness

- stronger session persistence
- git-aware safety and diff helpers
- resume-oriented artifacts

### 0.5.0 Extensibility

- provider abstraction maturity
- external tool registration boundaries
- groundwork for alternate shells

### 0.8.0 Desktop-Ready Core

- clean shell/core separation
- event and session protocol ready for desktop consumption
- reduced CLI-specific assumptions inside core

## Roadmap Rules

- each milestone should define `in scope`, `out of scope`, and `exit criteria`
- roadmap changes should be intentional, not silent drift
- if a milestone gets split, update both the roadmap and any affected release docs
