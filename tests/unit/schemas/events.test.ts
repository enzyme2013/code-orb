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
});
