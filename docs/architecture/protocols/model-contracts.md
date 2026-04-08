# Model Contracts

## Purpose

Model contracts define the shared runtime-facing request and response shape used between the turn query loop and provider adapters.

These contracts are not the same thing as any one provider's wire format.

## Runtime-Facing Questions

The shared model contract should answer:

1. what messages are being sent for this turn step?
2. what tools are available to the model?
3. what capabilities does the provider expose that affect runtime behavior?
4. what normalized assistant or tool-call output came back?
5. whether the adapter is in a native, compatible, or degraded mode

## Core Shapes

The current shared model contract includes:

- `ModelRequest`
  - session and turn identity
  - step identity when needed
  - ordered messages
  - model-facing tool definitions
  - optional generation controls
- `ModelResponse`
  - provider and model identity
  - assistant content
  - normalized tool calls
  - finish reason
  - compatibility metadata
- `ProviderCapabilities`
  - whether model-native tool calling is supported
  - whether streaming is supported
  - whether structured output is supported

## Shared Contract Versus Provider Wire Shape

The shared contract should remain stable even when provider wire shapes differ.

Examples:

- one provider may return text in a top-level field
- another may return text in nested output items
- another may only produce usable tool calls through a streaming transport

The adapter owns those differences.

The turn query loop should only consume the normalized shared shapes.

## Continuation State

Continuation state is related to the model runtime, but it is not itself part of the core turn-loop message semantics.

Examples:

- provider response identifiers
- websocket session reuse state
- future transport-specific continuation handles

The architectural owner of this state is the provider runtime. If some of it is temporarily preserved in message metadata for implementation convenience, that should be treated as a transitional technique rather than the long-term contract.

## Relationship To Tool Contracts

Model contracts and tool contracts meet at one boundary:

- `ModelRequest.tools` exposes model-facing tool definitions

Tool contracts still own:

- registration identity
- mutability
- approval requirement
- canonical runtime execution result

Model contracts own:

- how the provider sees tool availability
- how the provider returns tool-call intent

## Current `0.7.0` Closeout Focus

For `0.7.0`, the shared model contract still needs explicit closeout on:

- continuation ownership
  - what remains adapter-local versus what should surface as runtime state
- canonical finish and degradation semantics
  - what the loop can rely on when transport fallback occurs
- tool-result mapping boundary
  - how canonical runtime-owned tool results map into provider wire items without turning the wire shape into the runtime contract

## Related Docs

- [provider-runtime.md](../provider-runtime.md)
- [tool-contracts.md](./tool-contracts.md)
- [events.md](./events.md)
