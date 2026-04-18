import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";

function createTestIO(cwd: string, confirmDecision = true) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout: {
        write(message: string) {
          stdout.push(message);
        },
      },
      stderr: {
        write(message: string) {
          stderr.push(message);
        },
      },
      cwd: () => cwd,
      confirm: async () => confirmDecision,
    },
    stdout,
    stderr,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("saved session inspection", () => {
  it("lists saved sessions with turn counts and task summaries", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-session-list-"));
    tempDirs.push(tempRoot);

    await main(["run", "summarize", "the", "next", "action"], createTestIO(tempRoot).io);
    await main(["run", "continue", "the", "prior", "work"], createTestIO(tempRoot).io);

    const { io, stdout, stderr } = createTestIO(tempRoot);
    const exitCode = await main(["sessions", "list"], io);
    const output = stdout.join("");
    const sessionLines = output
      .split("\n")
      .filter((line) => line.startsWith("- ses_"));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(output).toContain("Saved sessions:");
    expect(sessionLines).toHaveLength(2);
    expect(sessionLines.every((line) => line.includes("| turns=1 |"))).toBe(true);
    expect(sessionLines.some((line) => line.includes("summarize the next action"))).toBe(true);
    expect(sessionLines.some((line) => line.includes("continue the prior work"))).toBe(true);
  });

  it("shows richer turn-level details for blocked sessions loaded from saved artifacts", async () => {
    const fixtureRoot = resolve("benchmarks/approval-denied/repo");
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-session-show-"));
    tempDirs.push(tempRoot);

    await cp(fixtureRoot, tempRoot, { recursive: true });

    const run = createTestIO(tempRoot, false);
    const runExitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      run.io,
    );

    const sessionFiles = await readdir(join(tempRoot, ".orb", "sessions"));
    const artifactName = sessionFiles.find((entry) => entry.endsWith(".json"));

    if (!artifactName) {
      throw new Error("expected saved session artifact");
    }

    const sessionId = basename(artifactName, ".json");
    const show = createTestIO(tempRoot);
    const showExitCode = await main(["sessions", "show", sessionId], show.io);
    const output = show.stdout.join("");

    expect(runExitCode).toBe(0);
    expect(showExitCode).toBe(0);
    expect(run.stderr).toEqual([]);
    expect(show.stderr).toEqual([]);
    expect(output).toContain(`Session: ${sessionId}`);
    expect(output).toContain("Outcome: cancelled");
    expect(output).toContain("Mutation requested: apply_patch (README.md)");
    expect(output).toContain("Mutation rejected: apply_patch (README.md)");
    expect(output).toContain("Turn 1 outcome: blocked");
    expect(output).toContain("Turn 1 summary: apply_patch was blocked because approval was denied.");
    expect(output).toContain("Turn 1 stop reason: tool_denied");
    expect(output).toContain("Turn 1 mutation requested: apply_patch (README.md)");
    expect(output).toContain("Turn 1 mutation rejected: apply_patch (README.md)");
    expect(output).toContain("Turn 1 risk: Mutating edit was blocked by approval denial.");
  });
});
