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

This milestone is expected to progress through two phases:

- Phase 1: runtime contracts and architectural hardening
- Phase 2: minimal end-to-end runnable loop

Phase detail:

- [phase-1-runtime-contracts.md](./phases/phase-1-runtime-contracts.md)
- [phase-2-minimal-loop.md](./phases/phase-2-minimal-loop.md)

Release detail: [releases/0.1.0.md](./releases/0.1.0.md)

### 0.2.0 Context

- better repository understanding
- richer file and search tooling
- improved planning inputs

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
