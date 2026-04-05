import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";

const benchmarkRoot = resolve("benchmarks/approval-denied/repo");
const tempParent = resolve(".tmp-benchmarks");

void main();

async function main(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "approval-denied-"));

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
        'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      ],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          CODE_ORB_AUTO_APPROVE: "0",
          CODE_ORB_BENCHMARK_REJECT_APPROVAL: "1",
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
