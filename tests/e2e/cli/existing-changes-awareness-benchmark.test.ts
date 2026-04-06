import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

describe("existing-changes-awareness benchmark", () => {
  it("distinguishes pre-existing dirty files from current-run changes", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "existing-changes-awareness-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/existing-changes-awareness/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    await runGit(["init"], tempRoot);
    await runGit(["config", "user.name", "Code Orb Benchmarks"], tempRoot);
    await runGit(["config", "user.email", "benchmarks@example.com"], tempRoot);
    await runGit(["add", "README.md", "verify.mjs"], tempRoot);
    await runGit(["commit", "-m", "initial"], tempRoot);
    await writeFile(join(tempRoot, "notes.txt"), "pre-existing change\n", "utf8");
    await runGit(["add", "notes.txt"], tempRoot);

    const { io, stdout, stderr } = createTestIO(tempRoot);
    const exitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      io,
    );

    const output = stdout.join("");
    const readme = await readFile(join(tempRoot, "README.md"), "utf8");
    const sessionFiles = await readdir(join(tempRoot, ".orb", "sessions"));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(readme).toContain("Hello, Code Orb!");
    expect(output).toContain("Repository dirty before run: yes");
    expect(output).toContain("Pre-existing change: notes.txt");
    expect(output).toContain("Current-run change: README.md");
    expect(sessionFiles.some((entry) => entry.endsWith(".json"))).toBe(true);
  });
});
