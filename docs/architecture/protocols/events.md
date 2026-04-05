# Event Protocol

## Purpose

Events are the primary structured record of what a session did. They support terminal rendering, debugging, observability, and future UI shells.

## Event Envelope

Every event should conceptually include:

```json
{
  "id": "evt_123",
  "sessionId": "ses_123",
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

## Initial Consumers

- CLI progress renderer
- debug logging
- future desktop activity timeline
- test harness assertions
