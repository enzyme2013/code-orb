import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalSessionStore } from "@code-orb/core";
import type { SessionArtifact } from "@code-orb/schemas";

async function createTempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "code-orb-session-store-"));
}

function createArtifact(overrides: Partial<SessionArtifact> = {}): SessionArtifact {
  return {
    schemaVersion: 1,
    sessionId: "ses_1",
    task: "summarize the next action",
    cwd: "/repo",
    startedAt: "2026-04-06T00:00:00.000Z",
    endedAt: "2026-04-06T00:00:02.000Z",
    savedAt: "2026-04-06T00:00:03.000Z",
    outcome: "completed",
    summary: "Create a short execution summary.",
    changedFiles: ["README.md"],
    validations: [],
    risks: ["No verification command was run."],
    turnReports: [
      {
        sessionId: "ses_1",
        turnId: "turn_1",
        outcome: "completed",
        summary: "Create a short execution summary.",
        filesChanged: ["README.md"],
        risks: ["No verification command was run."],
      },
    ],
    ...overrides,
  };
}

describe("LocalSessionStore", () => {
  it("saves, lists, and loads persisted session artifacts", async () => {
    const cwd = await createTempDirectory();
    const store = new LocalSessionStore();

    try {
      const savedFirst = await store.save(createArtifact({ cwd, sessionId: "ses_1", savedAt: "2026-04-06T00:00:03.000Z" }));
      const savedSecond = await store.save(createArtifact({ cwd, sessionId: "ses_2", savedAt: "2026-04-06T00:00:04.000Z" }));
      const listed = await store.list(cwd);
      const loaded = await store.load(cwd, "ses_1");

      expect(savedFirst.artifactPath).toContain(`${join(".orb", "sessions", "ses_1.json")}`);
      expect(savedSecond.artifactPath).toContain(`${join(".orb", "sessions", "ses_2.json")}`);
      expect(listed.map((artifact) => artifact.sessionId)).toEqual(["ses_2", "ses_1"]);
      expect(loaded?.summary).toBe("Create a short execution summary.");
      expect(await store.load(cwd, "ses_missing")).toBeNull();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
