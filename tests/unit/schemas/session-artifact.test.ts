import { describe, expect, it } from "vitest";

import type { SessionArtifact } from "@code-orb/schemas";

describe("session artifact contract", () => {
  it("supports serialization of persisted session results", () => {
    const artifact = {
      schemaVersion: 1,
      sessionId: "ses_1",
      task: "fix failing tests",
      cwd: "/repo",
      startedAt: "2026-04-06T00:00:00.000Z",
      endedAt: "2026-04-06T00:01:00.000Z",
      savedAt: "2026-04-06T00:01:01.000Z",
      outcome: "completed",
      summary: "Updated the implementation and verified the result.",
      changedFiles: ["src/index.ts"],
      validations: [
        {
          name: "pnpm test",
          status: "passed",
          details: "1 test passed",
        },
      ],
      risks: [],
      turnReports: [
        {
          sessionId: "ses_1",
          turnId: "turn_1",
          outcome: "completed",
          summary: "Updated the implementation and verified the result.",
          filesChanged: ["src/index.ts"],
          edits: [
            {
              mode: "targeted_replacement",
              path: "src/index.ts",
              changed: true,
              toolName: "apply_patch",
            },
          ],
          validations: [
            {
              name: "pnpm test",
              status: "passed",
            },
          ],
          risks: [],
        },
      ],
    } satisfies SessionArtifact;

    const restored = JSON.parse(JSON.stringify(artifact)) as SessionArtifact;

    expect(restored.sessionId).toBe("ses_1");
    expect(restored.changedFiles).toEqual(["src/index.ts"]);
    expect(restored.turnReports[0]?.edits?.[0]?.mode).toBe("targeted_replacement");
    expect(restored.turnReports[0]?.validations?.[0]?.status).toBe("passed");
  });
});
