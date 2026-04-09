import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";

const benchmarkRoot = resolve("benchmarks/project-instructions/repo");
const tempParent = resolve(".tmp-benchmarks");

void main();

async function main(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "project-instructions-"));

  try {
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const exitCode = await runCli(tempRoot);
    process.exitCode = exitCode;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
        "summarize the next action for this repository",
      ],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
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
