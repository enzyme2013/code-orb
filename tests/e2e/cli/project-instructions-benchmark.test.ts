import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

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

describe("project-instructions benchmark", () => {
  it("surfaces repository guidance in CLI output and the saved session artifact", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "project-instructions-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/project-instructions/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createTestIO(tempRoot);
    const exitCode = await main(["run", "summarize", "the", "next", "action", "for", "this", "repository"], io);

    const output = stdout.join("");
    const sessionFiles = await readdir(join(tempRoot, ".orb", "sessions"));
    const artifactName = sessionFiles.find((entry) => entry.endsWith(".json"));

    if (!artifactName) {
      throw new Error("expected project-instructions benchmark artifact");
    }

    const artifact = JSON.parse(
      await readFile(join(tempRoot, ".orb", "sessions", artifactName), "utf8"),
    ) as {
      projectInstructions?: Array<{ path: string }>;
    };

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(output).toContain("Project instructions: AGENTS.md");
    expect(artifact.projectInstructions).toEqual([{ path: "AGENTS.md", source: "repository" }]);
  });
});
