import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const benchmarkRoot = resolve("benchmarks/session-follow-up/repo");
const tempParent = resolve(".tmp-benchmarks");

void main();

async function main(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "session-follow-up-"));

  try {
    await cp(benchmarkRoot, tempRoot, { recursive: true });
    await initializeGitRepo(tempRoot);

    const firstExitCode = await runCli(tempRoot, [
      "run",
      'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
    ]);

    if (firstExitCode !== 0) {
      process.exitCode = firstExitCode;
      return;
    }

    const sessions = await readdir(join(tempRoot, ".orb", "sessions"));
    const sessionFile = sessions.find((entry) => entry.endsWith(".json"));

    if (!sessionFile) {
      throw new Error("Expected a saved session artifact after the first run.");
    }

    const sessionId = sessionFile.replace(/\.json$/, "");
    const secondExitCode = await runCli(tempRoot, [
      "run",
      "--from-session",
      sessionId,
      "continue the prior work and report the follow-up context",
    ]);

    process.exitCode = secondExitCode;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function initializeGitRepo(cwd: string): Promise<void> {
  await runCommand("git init", cwd);
  await runCommand("git config user.name \"Code Orb Benchmarks\"", cwd);
  await runCommand("git config user.email \"benchmarks@example.com\"", cwd);
  await runCommand("git add README.md verify.mjs", cwd);
  await runCommand("git commit -m \"initial\"", cwd);
}

function runCli(cwd: string, args: string[]): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child: ChildProcess = spawn("pnpm", ["run", "cli:run", "--", "--cwd", cwd, ...args], {
      cwd: resolve("."),
      env: {
        ...process.env,
        CODE_ORB_AUTO_APPROVE: process.env.CODE_ORB_AUTO_APPROVE ?? "1",
      },
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise(code ?? 1);
    });
  });
}

function runCommand(command: string, cwd: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Command failed: ${command}`));
    });
  });
}
