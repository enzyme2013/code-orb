import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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

describe("orb run end-to-end", () => {
  it("can inspect, edit, verify, and report on a fixture repository", async () => {
    const fixtureRoot = resolve("tests/fixtures/replace-string-repo");
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-fixture-"));
    tempDirs.push(tempRoot);

    await cp(fixtureRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr } = createTestIO(tempRoot);

    const exitCode = await main(
      [
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      io,
    );

    const updatedReadme = await readFile(join(tempRoot, "README.md"), "utf8");

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(updatedReadme).toContain("Hello, Code Orb!");

    const output = stdout.join("");
    expect(output).toContain("Session started:");
    expect(output).toContain("Tool started: search_text");
    expect(output).toContain("Tool started: apply_patch");
    expect(output).toContain("Verification started: node verify.mjs");
    expect(output).toContain("Validation passed: node verify.mjs");
    expect(output).toContain("Changed: README.md");
    expect(output).toContain("Risks: none");
    expect(output).toContain("Session complete:");
  });
});
