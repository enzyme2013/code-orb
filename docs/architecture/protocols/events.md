# Event Protocol

## Purpose

Events are the primary structured record of what a session did. They support terminal rendering, debugging, observability, and future UI shells.

Events should be treated as runtime infrastructure, not as ad hoc log lines.

## Event Envelope

Every event should conceptually include:

```json
{
  "id": "evt_123",
  "sessionId": "ses_123",
  "turnId": "turn_123",
  "stepId": "step_123",
  "type": "tool.started",
  "timestamp": "2026-04-05T00:00:00.000Z",
  "payload": {}
}
```

## Initial Event Families

- `session.*`
- `plan.*`
- `tool.*`
- `edit.*`
- `verify.*`
- `report.*`
- `error.*`

## Design Rules

- event types should be stable and semantic
- payloads should be schema-backed
- the event stream should be append-only from the perspective of consumers
- UI layers should render from events instead of inventing separate state models where possible
- events should describe runtime semantics, not only human-readable log text

## Initial Consumers

- CLI progress renderer
- debug logging
- future desktop activity timeline
- test harness assertions
- report assembly

## Minimum V0 Event Catalog

The minimum useful event set for V0 is:

- `session.started`
- `turn.started`
- `step.started`
- `plan.generated`
- `tool.started`
- `tool.finished`
- `tool.denied`
- `verify.started`
- `verify.finished`
- `turn.completed`
- `session.completed`
- `error.raised`
