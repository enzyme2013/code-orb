import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";

function createTestIO(cwd: string) {
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
    },
    stdout,
    stderr,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("orb run project instructions", () => {
  it("surfaces repository AGENTS.md loading during normal CLI execution", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-project-instructions-"));
    tempDirs.push(tempRoot);

    await writeFile(join(tempRoot, "AGENTS.md"), "# Repo Rules\n\n- Keep summaries short.\n", "utf8");

    const { io, stdout, stderr } = createTestIO(tempRoot);
    const exitCode = await main(["run", "summarize", "the", "next", "action"], io);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);

    const output = stdout.join("");
    expect(output).toContain("Session started:");
    expect(output).toContain("Project instructions: AGENTS.md");
    expect(output).toContain("Session complete:");
  });
});
