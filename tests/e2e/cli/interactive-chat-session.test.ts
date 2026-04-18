import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";

function createInteractiveTestIO(cwd: string, responses: Array<string | null>, confirmDecision = true) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const prompts: string[] = [];

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
      prompt: async (message: string) => {
        prompts.push(message);
        return responses.shift() ?? null;
      },
    },
    stdout,
    stderr,
    prompts,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("orb chat end-to-end", () => {
  it("supports a multi-turn interactive coding session and writes one session artifact", async () => {
    const fixtureRoot = resolve("tests/fixtures/replace-string-repo");
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-chat-fixture-"));
    tempDirs.push(tempRoot);

    await cp(fixtureRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr, prompts } = createInteractiveTestIO(tempRoot, [
      "/help",
      'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      "/history",
      "/status",
      "continue the prior work",
      "/exit",
    ]);

    const exitCode = await main(["chat"], io);

    const output = stdout.join("");
    const updatedReadme = await readFile(join(tempRoot, "README.md"), "utf8");
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
    expect(prompts).toEqual(["orb> ", "orb> ", "orb> ", "orb> ", "orb> ", "orb> "]);
    expect(updatedReadme).toContain("Hello, Code Orb!");
    expect(output).toContain("Interactive session started. Type /help for commands.");
    expect(output).toContain("Interactive commands:");
    expect(output).toContain("/history Show prior turns in this session");
    expect(output).toContain("Turn 1: Update README.md by replacing");
    expect(output).toContain("Turn history:");
    expect(output).toContain("- Turn 1 | completed | Updated README.md and ran verification");
    expect(output).toContain("Turn 2: continue the prior work");
    expect(output).toContain("Turns: 1");
    expect(output).toContain("Mode: interactive");
    expect(output).toContain("Interactive session exiting.");
    expect(output).toContain("Session outcome: completed");
    expect(sessionFiles.filter((entry) => entry.endsWith(".json"))).toHaveLength(1);
    expect(artifact.turnReports).toHaveLength(2);
  });

  it("keeps inspection commands usable after an approval-rejected interactive turn", async () => {
    const fixtureRoot = resolve("benchmarks/approval-denied/repo");
    const tempRoot = await mkdtemp(join(tmpdir(), "code-orb-chat-fixture-"));
    tempDirs.push(tempRoot);

    await cp(fixtureRoot, tempRoot, { recursive: true });

    const { io, stdout, stderr, prompts } = createInteractiveTestIO(
      tempRoot,
      [
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
        "/history",
        "/status",
        "/exit",
      ],
      false,
    );

    const exitCode = await main(["chat"], io);

    const output = stdout.join("");
    const sessionFiles = await readdir(join(tempRoot, ".orb", "sessions"));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(prompts).toEqual(["orb> ", "orb> ", "orb> ", "orb> "]);
    expect(output).toContain("Approval requested: Approve apply_patch on README.md");
    expect(output).toContain("Approval rejected: apply_patch");
    expect(output).toContain("Turn status: blocked");
    expect(output).toContain("Turn history:");
    expect(output).toContain("- Turn 1 | blocked | apply_patch was blocked because approval was denied.");
    expect(output).toContain("Stop reason: tool_denied");
    expect(output).toContain("Last turn status: blocked");
    expect(output).toContain("Last stop reason: tool_denied");
    expect(output).toContain("Session outcome: cancelled");
    expect(sessionFiles.filter((entry) => entry.endsWith(".json"))).toHaveLength(1);
  });
});
