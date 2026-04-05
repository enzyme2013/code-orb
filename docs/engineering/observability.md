# Observability

## Goal

The system should make it easy to understand what the agent did, not just whether it exited successfully.

## Initial Artifacts

- structured event stream
- final session report
- command execution metadata
- edit summaries

## Consumers

- CLI progress rendering
- debugging during development
- future desktop activity views
- automated test assertions

## Rule

If a feature changes what the agent does in a meaningful way, it should also be reflected in an observable artifact rather than hidden entirely in internal state.
