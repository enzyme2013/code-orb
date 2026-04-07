# ADR 0004: Runtime-Owned Extensibility Baseline Before The Full Query Loop

- Status: Accepted
- Date: 2026-04-08

## Context

`0.5.0` made the interactive CLI usable, but two release-closeout fixes exposed tactical runtime paths that should not become long-term architecture:

- some OpenAI-compatible gateways only produced usable assistant text after a streaming fallback path
- some assistant-produced single-file edits still depended on conversational code-block inference and filename heuristics before a repository write happened

At the same time, built-in tools are still effectively defined inside executor-local implementation, which is too implicit for the later tool-runtime work planned for `0.7.0`.

If these boundaries stay implicit, future shell extraction, provider support, and tool-runtime work will be shaped accidentally by tactical `0.5.x` recovery code.

## Decision

Before implementing the full reusable query loop in `0.7.0`, establish this `0.6.0` baseline:

1. provider compatibility is runtime-owned but adapter-normalized
   - adapters may handle provider-specific response quirks
   - core runtime should consume normalized capabilities, normalized response semantics, and explicit degraded or unsupported outcomes
   - CLI shells should not own provider correctness fallbacks
2. assistant-produced edit execution is an explicit runtime contract
   - assistant output that becomes a repository mutation must be modeled as a runtime behavior, not only as conversational text
   - the baseline edit modes are:
     - generated create
     - generated rewrite
     - targeted replacement
   - these modes must remain auditable and must still route through policy and approval handling
3. tool registration is distinct from tool execution
   - built-in tools should be made available through a runtime-owned registration boundary
   - registration, lookup, validation, dispatch, and backend execution are distinct concerns even if early implementations still colocate several of them
   - shells should not own the tool catalog
4. `0.6.0` documents the current loop contract but does not yet implement the full generic multi-iteration loop
   - `0.6.0` should define what one current runtime iteration means, and how continue or stop conditions are interpreted now
   - `0.7.0` remains responsible for the broader reusable multi-iteration runtime

## Consequences

### Positive

- makes `0.5.x` recovery behavior explicit instead of accidental
- gives later shells a clearer runtime boundary to reuse
- gives `0.7.0` a stable starting point for tool runtime and loop work
- reduces the chance that provider quirks or conversational heuristics silently become product architecture

### Negative

- adds contract and documentation work before the broader runtime refactor is complete
- may temporarily expose places where existing schemas or events are not yet expressive enough
- requires discipline to keep `0.6.0` from expanding into a larger runtime rewrite

## Follow-Up

`0.6.0` follow-up work should:

- update architecture docs wherever the provider, generated-edit, or tool-registration contract becomes explicit
- evolve schemas and runtime behavior to match the documented baseline
- keep `0.7.0` focused on reusable loop and orchestration behavior rather than reopening these boundary decisions
