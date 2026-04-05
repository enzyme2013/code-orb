import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
      confirm: async () => false,
    },
    stdout,
    stderr,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("approval-denied benchmark", () => {
  it("reports a blocked edit and cancelled session when approval is rejected", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "approval-denied-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/approval-denied/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createTestIO(tempRoot);

    const exitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      io,
    );

    const readme = await readFile(join(tempRoot, "README.md"), "utf8");
    const output = stdout.join("");

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(readme).toContain("__CODE_ORB_PLACEHOLDER__");
    expect(readme).not.toContain("Hello, Code Orb!");
    expect(output).toContain("Tool denied: apply_patch (approval rejected)");
    expect(output).toContain("Turn complete: apply_patch was blocked because approval was denied.");
    expect(output).toContain("Turn status: blocked");
    expect(output).toContain("Session outcome: cancelled");
    expect(output).not.toContain("Verification started: node verify.mjs");
  });
});
