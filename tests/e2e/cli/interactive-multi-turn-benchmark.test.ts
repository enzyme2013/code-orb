import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";

function createInteractiveTestIO(cwd: string, responses: Array<string | null>) {
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
      confirm: async () => true,
      prompt: async () => responses.shift() ?? null,
    },
    stdout,
    stderr,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("interactive-multi-turn benchmark", () => {
  it("keeps two turns in one interactive session artifact", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "interactive-multi-turn-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/interactive-multi-turn/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createInteractiveTestIO(tempRoot, [
      'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      "continue the prior work",
      "/exit",
    ]);

    const exitCode = await main(["chat"], io);
    const output = stdout.join("");
    const readme = await readFile(join(tempRoot, "README.md"), "utf8");
    const sessionFiles = await readdir(join(tempRoot, ".orb", "sessions"));
    const artifactName = sessionFiles.find((entry) => entry.endsWith(".json"));

    if (!artifactName) {
      throw new Error("expected interactive session artifact");
    }

    const artifact = JSON.parse(await readFile(join(tempRoot, ".orb", "sessions", artifactName), "utf8")) as {
      turnReports?: unknown[];
    };

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(readme).toContain("Hello, Code Orb!");
    expect(output).toContain("Turn 1: Update README.md by replacing");
    expect(output).toContain("Turn 2: continue the prior work");
    expect(output).toContain("Session outcome: completed");
    expect(sessionFiles.filter((entry) => entry.endsWith(".json"))).toHaveLength(1);
    expect(artifact.turnReports).toHaveLength(2);
  });
});
