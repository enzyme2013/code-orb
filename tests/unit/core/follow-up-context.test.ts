import { describe, expect, it } from "vitest";

import { buildFollowUpContext } from "../../../packages/core/src/index";

describe("buildFollowUpContext", () => {
  it("builds a minimal follow-up context from a saved artifact", () => {
    const context = buildFollowUpContext({
      schemaVersion: 1,
      sessionId: "ses_1",
      task: "fix failing tests",
      cwd: "/repo",
      startedAt: "2026-04-06T00:00:00.000Z",
      endedAt: "2026-04-06T00:00:10.000Z",
      savedAt: "2026-04-06T00:00:11.000Z",
      outcome: "completed",
      summary: "Updated the implementation and verified the result.",
      changedFiles: ["src/index.ts"],
      validations: [{ name: "pnpm test", status: "passed" }],
      risks: [],
      turnReports: [],
    });

    expect(context).toEqual({
      priorSessionId: "ses_1",
      priorTask: "fix failing tests",
      priorOutcome: "completed",
      priorSummary: "Updated the implementation and verified the result.",
      priorChangedFiles: ["src/index.ts"],
      priorValidations: [{ name: "pnpm test", status: "passed" }],
      priorRisks: [],
    });
  });
});
