# ADR 0001: TypeScript And Node.js For A CLI-First Core

- Status: Accepted
- Date: 2026-04-05

## Context

The project is starting from zero and needs to validate the usefulness of a coding agent quickly. The main short-term risks are product-loop quality, tool orchestration, safety, and verification, not raw compute throughput.

## Decision

Use TypeScript and Node.js for the initial CLI and orchestration layers.

Heavy or performance-sensitive work should be delegated to external tools or future native components rather than forcing the entire system into a systems language up front.

## Consequences

### Positive

- faster bootstrap and iteration
- strong ecosystem for CLI tooling and AI integration
- easier path to future desktop shells that reuse web-adjacent tooling

### Negative

- some future subsystems may need native acceleration
- process and resource control is weaker than a lower-level runtime

## Follow-Up

If a specific subsystem becomes performance-sensitive, isolate it behind a stable boundary first and then evaluate whether it should move to Rust or another native implementation.
