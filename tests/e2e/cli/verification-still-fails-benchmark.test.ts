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

describe("verification-still-fails benchmark", () => {
  it("reports a failed verification outcome after applying the requested edit", async () => {
    const tempParent = resolve(".tmp-benchmarks");
    await mkdir(tempParent, { recursive: true });

    const tempRoot = await mkdtemp(join(tempParent, "verification-still-fails-"));
    tempDirs.push(tempRoot);

    const benchmarkRoot = resolve("benchmarks/verification-still-fails/repo");
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createTestIO(tempRoot);

    const exitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      io,
    );

    const updatedReadme = await readFile(join(tempRoot, "README.md"), "utf8");
    const output = stdout.join("");

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(updatedReadme).toContain("Hello, Code Orb!");
    expect(output).toContain("Verification failed: node verify.mjs");
    expect(output).toContain("Validation failed: node verify.mjs");
    expect(output).toContain("Turn status: failed");
    expect(output).toContain("Changed: README.md");
    expect(output).toContain("Turn complete: Updated README.md, but verification still failed.");
  });
});
