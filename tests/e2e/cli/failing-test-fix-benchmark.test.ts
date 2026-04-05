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
    },
    stdout,
    stderr,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("failing-test-fix benchmark", () => {
  it("can fix the benchmark repo from a natural-language failing-test-fix request", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "failing-test-fix-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/failing-test-fix/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createTestIO(tempRoot);

    const exitCode = await main(
      [
        "run",
        "Fix the failing test without changing the intended behavior. Start by running node verify.mjs, then inspect the failing code, make the smallest implementation fix, rerun node verify.mjs, and report the result.",
      ],
      io,
    );

    const updatedChunk = await readFile(join(tempRoot, "src/chunk.ts"), "utf8");
    const output = stdout.join("");

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(updatedChunk).toContain("index < items.length");
    expect(output).toContain("Verification failed: node verify.mjs");
    expect(output).toContain("Validation passed: node verify.mjs");
    expect(output).toContain("Changed: src/chunk.ts");
    expect(output).toContain("Turn complete: Fixed chunk so it preserves the final partial chunk before verification rerun");
  }, 15000);
});
