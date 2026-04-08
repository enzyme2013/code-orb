import { describe, expect, it } from "vitest";

import type { SessionRuntimeState, StepRuntimeState, TurnRuntimeState } from "@code-orb/schemas";

describe("runtime contracts", () => {
  it("models session, turn, and step as separate layers", () => {
    const step: StepRuntimeState = {
      id: "step_1",
      sessionId: "ses_1",
      turnId: "turn_1",
      index: 0,
      kind: "planning",
      status: "running",
      startedAt: "2026-04-05T00:00:00.000Z",
      toolCallIds: [],
    };

    const turn: TurnRuntimeState = {
      id: "turn_1",
      sessionId: "ses_1",
      index: 0,
      status: "running",
      input: {
        content: "fix failing tests",
        source: "user",
      },
      startedAt: "2026-04-05T00:00:00.000Z",
      steps: [step],
    };

    const session: SessionRuntimeState = {
      id: "ses_1",
      cwd: "/repo",
      task: "fix failing tests",
      status: "running",
      startedAt: "2026-04-05T00:00:00.000Z",
      turns: [turn],
    };

    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.steps).toHaveLength(1);
    expect(session.turns[0]?.steps[0]?.kind).toBe("planning");
  });

  it("supports structured turn plan items for future execution tracking", () => {
    const turn: TurnRuntimeState = {
      id: "turn_1",
      sessionId: "ses_1",
      index: 0,
      status: "running",
      input: {
        content: "fix failing tests",
        source: "user",
      },
      startedAt: "2026-04-05T00:00:00.000Z",
      plan: {
        summary: "Inspect failures and propose a fix",
        items: [
          {
            id: "plan_1",
            content: "Read the failing test output",
            status: "pending",
          },
        ],
      },
      steps: [],
    };

    expect(turn.plan?.items[0]?.id).toBe("plan_1");
    expect(turn.plan?.items[0]?.status).toBe("pending");
  });

  it("supports explicit stop reasons and model follow-up steps inside one turn", () => {
    const step: StepRuntimeState = {
      id: "step_2",
      sessionId: "ses_1",
      turnId: "turn_1",
      index: 1,
      kind: "model",
      status: "completed",
      startedAt: "2026-04-08T00:00:00.000Z",
      endedAt: "2026-04-08T00:00:01.000Z",
      toolCallIds: [],
    };

    const turn: TurnRuntimeState = {
      id: "turn_1",
      sessionId: "ses_1",
      index: 0,
      status: "completed",
      input: {
        content: "summarize the tool result",
        source: "user",
      },
      startedAt: "2026-04-08T00:00:00.000Z",
      steps: [step],
      stopReason: "task_completed",
      iterationCount: 2,
    };

    expect(turn.steps[0]?.kind).toBe("model");
    expect(turn.stopReason).toBe("task_completed");
    expect(turn.iterationCount).toBe(2);
  });
});
