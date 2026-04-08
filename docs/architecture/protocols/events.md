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
- `assistant.*`
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
- provider fallback or degraded compatibility behavior that affects correctness should be observable as runtime behavior rather than hidden entirely inside adapters
- assistant-produced edit execution should be observable through runtime events or schema-backed metadata, not only through conversational text

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
- `assistant.message`
- `plan.generated`
- `edit.applied`
- `tool.started`
- `tool.finished`
- `tool.denied`
- `verify.started`
- `verify.finished`
- `turn.completed`
- `session.completed`
- `error.raised`

## 0.6 Event Baseline

`0.6.0` should make two kinds of runtime behavior more explicit in the event model:

- provider compatibility outcomes
  - the runtime should be able to tell the difference between a normal provider response, a degraded compatibility path, and a terminal unsupported or empty-content outcome
- generated edit execution outcomes
  - the runtime should be able to tell whether assistant-produced output became a generated create, generated rewrite, or targeted replacement

This does not require `0.6.0` to introduce a large new event catalog immediately.

It does require these semantics to become observable through either:

- dedicated `edit.*` or related future event families
- enriched schema-backed `tool.*`, `report.*`, or error payloads

Consumers should not have to infer critical runtime behavior only from assistant prose or CLI formatting.

The current `0.6.0` baseline now includes `edit.applied` as the explicit runtime event for successful auditable edit execution.

## 0.7 Event Implications

`0.7.0` keeps the same compact event catalog but changes how it is used:

- `assistant.message` may occur more than once inside one turn because tool results can trigger a follow-up `model` step
- `step.started` now includes `model` as an explicit step kind for post-tool model continuation
- `turn.completed` now carries a turn report that can include:
  - `stopReason`
  - `stepCount`

This keeps the event surface compact while making the multi-iteration turn loop observable to renderers and tests.

Provider continuation and fallback semantics should also remain observable, whether through:

- existing payload enrichment such as compatibility or stop-reason metadata
- explicit terminal error events
- future dedicated provider-runtime event families if the compact catalog stops being sufficient

Consumers should not have to guess whether a turn stopped because the loop made a decision or because the provider adapter hit a continuation or transport boundary.
