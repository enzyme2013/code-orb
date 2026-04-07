import { describe, expect, it } from "vitest";

import type { RuntimeEvent } from "@code-orb/schemas";

describe("event contracts", () => {
  it("supports structured session lifecycle events", () => {
    const event = {
      id: "evt_1",
      sessionId: "ses_1",
      type: "session.started",
      timestamp: "2026-04-05T00:00:00.000Z",
      payload: {
        task: "fix failing tests",
        cwd: "/repo",
      },
    } satisfies RuntimeEvent;

    expect(event.type).toBe("session.started");
    expect(event.payload.task).toBe("fix failing tests");
  });

  it("supports structured tool denial events", () => {
    const event = {
      id: "evt_2",
      sessionId: "ses_1",
      turnId: "turn_1",
      stepId: "step_1",
      type: "tool.denied",
      timestamp: "2026-04-05T00:00:01.000Z",
      payload: {
        request: {
          id: "call_1",
          sessionId: "ses_1",
          turnId: "turn_1",
          stepId: "step_1",
          toolName: "run_command",
          input: {
            command: "git reset --hard",
          },
          requestedAt: "2026-04-05T00:00:01.000Z",
        },
        decision: {
          type: "deny",
          reason: "destructive git commands are blocked",
        },
      },
    } satisfies RuntimeEvent;

    expect(event.type).toBe("tool.denied");
    expect(event.payload.decision.type).toBe("deny");
  });

  it("supports assistant message events with provider compatibility metadata", () => {
    const event = {
      id: "evt_3",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "assistant.message",
      timestamp: "2026-04-05T00:00:02.000Z",
      payload: {
        content: "hello from a compatibility fallback",
        provider: "openai",
        model: "gpt-test",
        compatibility: {
          status: "compatible",
          path: "chat_completions_choices",
        },
      },
    } satisfies RuntimeEvent;

    expect(event.type).toBe("assistant.message");
    expect(event.payload.compatibility?.path).toBe("chat_completions_choices");
  });

  it("supports explicit applied-edit runtime events", () => {
    const event = {
      id: "evt_4",
      sessionId: "ses_1",
      turnId: "turn_1",
      stepId: "step_2",
      type: "edit.applied",
      timestamp: "2026-04-05T00:00:03.000Z",
      payload: {
        edit: {
          mode: "generated_create",
          path: "scripts/show-disk-space.sh",
          changed: true,
          toolName: "apply_patch",
          created: true,
          targetSource: "inferred",
        },
      },
    } satisfies RuntimeEvent;

    expect(event.type).toBe("edit.applied");
    expect(event.payload.edit.mode).toBe("generated_create");
    expect(event.payload.edit.targetSource).toBe("inferred");
  });
});
