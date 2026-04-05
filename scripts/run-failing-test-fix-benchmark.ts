import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const benchmarkRoot = resolve("benchmarks/failing-test-fix/repo");
const tempParent = resolve(".tmp-benchmarks");

void main();

async function main(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "failing-test-fix-"));

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
        "Fix the failing test without changing the intended behavior. Start by running node verify.mjs, then inspect the failing code, make the smallest implementation fix, rerun node verify.mjs, and report the result.",
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
