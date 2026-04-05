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
});
