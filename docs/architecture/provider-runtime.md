# Provider Runtime

## Purpose

This document defines the runtime boundary between the turn query loop and provider-specific transport behavior.

The goal is to keep provider correctness and fallback behavior adapter-owned instead of letting transport quirks leak into shell code, tool logic, or turn-loop semantics.

## Boundary

The provider runtime sits between the turn query loop and the external model API.

```text
Turn Query Loop
  -> Provider Adapter
  -> External Model Transport
```

The turn query loop should consume normalized model behavior.

The provider adapter should own:

- transport selection
- request construction
- response normalization
- continuation state handling
- fallback policy when transport or continuation assumptions fail
- capability exposure that affects runtime correctness

## Responsibilities

### 1. Transport Selection

The adapter chooses the transport used to talk to the provider.

Examples:

- non-streaming HTTP request
- streaming HTTP request
- future websocket or proxy-backed transport

This choice should remain adapter-owned. The turn loop should not need to know whether a response came from HTTP, streaming fallback, or a future websocket path.

### 2. Response Normalization

The adapter converts provider-native payloads into the shared model contract.

Normalization should make these concerns explicit:

- assistant text
- tool calls
- finish reason
- provider compatibility status
- terminal provider error

The loop should not depend on provider-local response fields.

### 3. Continuation State

Continuation state is provider runtime state, not generic conversation semantics.

Examples:

- prior response identifiers
- transport reuse hints
- future websocket session handles

This state may currently be preserved in message metadata as a transitional implementation detail, but the architectural owner is the provider adapter and, when needed, session-owned provider state.

### 4. Fallback Policy

The adapter owns the policy for what happens when the ideal path fails.

Examples:

- non-streaming returns no usable content, so streaming fallback is attempted
- incremental continuation fails, so the adapter may fall back to a full request replay
- provider-native tool calling is unsupported, so the loop sees capability `toolCalling = false`

Fallback policy must be explicit, testable, and observable.

## Contract With The Turn Query Loop

The turn query loop should be able to ask:

1. what capabilities are available for this turn?
2. what normalized assistant or tool-call output was produced?
3. is the provider in a degraded but still usable mode?
4. did the adapter reach a terminal provider failure?

The turn loop should not have to ask:

- which HTTP shape was used
- which fallback branch was taken internally
- how a provider-specific continuation token is serialized

## Safety Integration

The provider adapter does not own tool safety policy.

The adapter may:

- expose capability differences
- retry or fall back between transport strategies
- preserve continuation state

The adapter may not:

- bypass approval
- reinterpret mutating tool calls as inherently safe
- hide terminal provider failures behind fabricated successful tool or assistant output

## Current `0.7.0` Closeout Focus

For `0.7.0`, the provider runtime still needs explicit closeout in three places:

- continuation policy
  - when incremental follow-up is used
  - when it falls back to a full request
- transport policy
  - how non-streaming, streaming, and future transport choices are selected
- canonical tool-result mapping
  - define the runtime-owned tool-result payload before mapping it to provider-specific wire formats such as `function_call_output`

## Related Docs

- [execution-model.md](./execution-model.md)
- [tool-system.md](./tool-system.md)
- [model-contracts.md](./protocols/model-contracts.md)
- [tool-contracts.md](./protocols/tool-contracts.md)
- [events.md](./protocols/events.md)
