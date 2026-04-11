import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("cli entrypoint", () => {
  it("executes the real TypeScript CLI entrypoint through node --import tsx", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-entrypoint-"));
    tempDirs.push(cwd);

    const { exitCode, stdout, stderr } = await runCli([
      "--cwd",
      cwd,
      "run",
      "summarize the next action",
    ]);

    const sessions = await readdir(join(cwd, ".orb", "sessions"));

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Session started: summarize the next action");
    expect(stdout).toContain("Session complete:");
    expect(sessions.some((entry) => entry.endsWith(".json"))).toBe(true);
  });
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      "node",
      ["--import", "tsx", resolve("apps/cli/src/main.ts"), ...args],
      {
        cwd: resolve("."),
        env: sanitizedEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolveResult({
        exitCode: exitCode ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  delete env.OPENAI_API_KEY;
  delete env.OPENAI_MODEL;
  delete env.OPENAI_BASE_URL;

  return env;
}
