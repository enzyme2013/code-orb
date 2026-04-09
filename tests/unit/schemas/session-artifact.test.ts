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
      notes: ["Provider compatibility path: responses_streaming_fallback"],
      projectInstructions: [
        {
          path: "AGENTS.md",
          source: "repository",
        },
      ],
      mutatingActions: [
        {
          toolName: "apply_patch",
          status: "applied",
          summary: "apply_patch changed src/index.ts.",
          path: "src/index.ts",
        },
      ],
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
          notes: ["Provider compatibility path: responses_streaming_fallback"],
          projectInstructions: [
            {
              path: "AGENTS.md",
              source: "repository",
            },
          ],
          mutatingActions: [
            {
              toolName: "apply_patch",
              status: "applied",
              summary: "apply_patch changed src/index.ts.",
              path: "src/index.ts",
            },
          ],
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
    expect(restored.projectInstructions).toEqual([
      {
        path: "AGENTS.md",
        source: "repository",
      },
    ]);
    expect(restored.notes).toEqual(["Provider compatibility path: responses_streaming_fallback"]);
    expect(restored.mutatingActions?.[0]?.status).toBe("applied");
    expect(restored.changedFiles).toEqual(["src/index.ts"]);
    expect(restored.turnReports[0]?.edits?.[0]?.mode).toBe("targeted_replacement");
    expect(restored.turnReports[0]?.validations?.[0]?.status).toBe("passed");
  });
});
