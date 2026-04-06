import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const benchmarkRoot = resolve("benchmarks/existing-changes-awareness/repo");
const tempParent = resolve(".tmp-benchmarks");

void main();

async function main(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "existing-changes-awareness-"));

  try {
    await cp(benchmarkRoot, tempRoot, { recursive: true });
    await initializeDirtyGitRepo(tempRoot);

    const exitCode = await runCli(tempRoot);
    process.exitCode = exitCode;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function initializeDirtyGitRepo(cwd: string): Promise<void> {
  await runCommand("git init", cwd);
  await runCommand("git config user.name \"Code Orb Benchmarks\"", cwd);
  await runCommand("git config user.email \"benchmarks@example.com\"", cwd);
  await runCommand("git add README.md verify.mjs", cwd);
  await runCommand("git commit --allow-empty -m \"initial\"", cwd);
  await writeFile(join(cwd, "notes.txt"), "pre-existing change\n", "utf8");
  await runCommand("git add notes.txt", cwd);
}

function runCli(cwd: string): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child: ChildProcess = spawn(
      "pnpm",
      [
        "run",
        "cli:run",
        "--",
        "--cwd",
        cwd,
        "run",
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          CODE_ORB_AUTO_APPROVE: process.env.CODE_ORB_AUTO_APPROVE ?? "1",
        },
        stdio: "inherit",
      },
    );

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
