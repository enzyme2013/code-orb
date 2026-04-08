# ADR 0006: Session Engine And Turn Query Loop Are Distinct Runtime Boundaries

- Status: Accepted
- Date: 2026-04-08

## Context

`0.7.0` introduced an explicit multi-iteration turn loop, but the current implementation still risks collapsing too much responsibility into one compact engine shape.

At the same time, the architecture correction for `0.7.0` and `0.8.0` depends on keeping three kinds of state distinct:

- session-owned state
- single-turn loop state
- provider-adapter state

If these concerns stay implicit, later shells and CLI usability work will inherit one oversized engine object and reopen architecture decisions that should have been settled in `0.7.0`.

## Decision

Code Orb should treat these as distinct runtime boundaries:

1. `Session Engine`
   - owns session lifecycle
   - owns cross-turn state
   - owns artifact and repository-state bookkeeping
   - owns provider-session context when needed
2. `Turn Query Loop`
   - owns one turn's internal iterations
   - owns step transitions, stop reasons, verification, and repair re-entry
3. `Input Processing`
   - owns local command routing, task normalization, and context injection before the turn loop runs

The current implementation may still colocate part of this behavior in a smaller set of classes during `0.7.0`, but the architectural ownership must remain explicit.

## Consequences

### Positive

- gives `0.8.0` a stable runtime skeleton to harden instead of redesigning
- keeps future shells from depending on one monolithic engine object
- makes provider and session state ownership easier to reason about

### Negative

- requires more documentation and discipline before the runtime extraction is complete
- may temporarily leave implementation and architecture separated by an explicit target boundary

## Follow-Up

`0.7.0` follow-up work should:

- document the boundary clearly in architecture docs
- decide whether the current implementation split is sufficient or whether a further runtime extraction patch is needed
- avoid pushing this layering question into `0.8.0`
