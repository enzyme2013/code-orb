# ADR 0007: Provider Adapters Own Transport, Continuation, And Fallback Policy

- Status: Accepted
- Date: 2026-04-08

## Context

Live-provider testing for `0.7.0` showed that a functioning turn loop does not guarantee a functioning provider path.

Code Orb could:

- advertise tools
- receive provider-native tool calls
- execute the requested tools

But the configured OpenAI-compatible gateway still failed the follow-up continuation request.

This exposed a design gap:

- transport choice, continuation handling, and fallback policy were not yet explicit runtime-owned adapter responsibilities

Reviewing Codex also reinforced that provider robustness is not just a loop concern. Transport reuse, incremental continuation, and fallback to full requests are treated as provider-client behavior, not shell logic or tool logic.

## Decision

Provider adapters in Code Orb own:

1. transport selection
   - non-streaming HTTP
   - streaming fallback
   - future websocket or proxy-backed transports
2. response normalization
   - convert provider-native payloads into the shared model contract
3. continuation state handling
   - preserve and apply provider-specific continuation state
4. fallback policy
   - decide when degraded recovery or full-request fallback is attempted

The turn query loop should consume normalized provider behavior and terminal provider outcomes.

It should not own provider-specific transport branching.

## Consequences

### Positive

- keeps transport quirks from leaking into shell or tool logic
- makes provider fallback policy testable and documentable
- aligns Code Orb more closely with the provider-runtime robustness learned from Codex

### Negative

- increases the design responsibility of provider adapters
- forces explicit decisions about canonical tool-result payloads versus provider wire encodings

## Follow-Up

`0.7.0` follow-up work should:

- document provider runtime and model-contract boundaries explicitly
- define the canonical runtime-owned tool-result payload before mapping it onto provider-specific wire formats
- decide whether continuation fallback lands in `0.7.0` closeout or is deferred with explicit version ownership
