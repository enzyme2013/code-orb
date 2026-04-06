import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";
import { runGit } from "../../helpers/git";

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

describe("session-follow-up benchmark", () => {
  it("runs a second task from a saved session artifact", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "session-follow-up-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/session-follow-up/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    await runGit(["init"], tempRoot);
    await runGit(["config", "user.name", "Code Orb Benchmarks"], tempRoot);
    await runGit(["config", "user.email", "benchmarks@example.com"], tempRoot);
    await runGit(["add", "README.md", "verify.mjs"], tempRoot);
    await runGit(["commit", "-m", "initial"], tempRoot);

    const { io, stdout, stderr } = createTestIO(tempRoot);
    const firstExitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      io,
    );

    expect(firstExitCode).toBe(0);
    expect(stderr).toEqual([]);

    const sessionFilesAfterFirstRun = await readdir(join(tempRoot, ".orb", "sessions"));
    const firstSessionFile = sessionFilesAfterFirstRun.find((entry) => entry.endsWith(".json"));

    if (!firstSessionFile) {
      throw new Error("expected a saved session artifact after the first run");
    }

    const firstSessionId = firstSessionFile.replace(/\.json$/, "");

    stdout.length = 0;
    stderr.length = 0;

    const secondExitCode = await main(
      ["run", "--from-session", firstSessionId, "continue", "the", "prior", "work"],
      io,
    );

    const output = stdout.join("");
    const sessionFilesAfterSecondRun = await readdir(join(tempRoot, ".orb", "sessions"));

    expect(secondExitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(output).toContain(`Follow-up from session: ${firstSessionId}`);
    expect(sessionFilesAfterSecondRun.length).toBeGreaterThanOrEqual(2);

    stdout.length = 0;
    const listExitCode = await main(["sessions", "list"], io);

    expect(listExitCode).toBe(0);
    expect(stdout.join("")).toContain(firstSessionId);
  });
});
