# ADR 0003: Single-Process CLI Before Daemon Or Multi-Agent Models

- Status: Accepted
- Date: 2026-04-05

## Context

The core loop has not yet been validated. Introducing a daemon or multi-agent runtime early would add protocol, lifecycle, and observability complexity before the product semantics are proven.

## Decision

Start with a single-process CLI runtime where one foreground task owns one session.

## Consequences

### Positive

- simpler debugging and validation
- fewer lifecycle failure modes
- faster path to a reliable end-to-end loop

### Negative

- less opportunity for background state reuse
- future client/server boundaries will need a deliberate extraction step

## Follow-Up

If a daemon is added later, preserve the same session lifecycle and event contracts wherever possible.
