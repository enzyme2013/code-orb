import { spawn } from "node:child_process";

export async function runGit(args: string[], cwd: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);

    child.on("close", (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      });
    });
  });
}

export async function ensureGitRepository(cwd: string): Promise<void> {
  const initResult = await runGit(["init"], cwd);

  if (initResult.exitCode !== 0) {
    throw new Error(initResult.stderr.trim() || "Failed to initialize git repository.");
  }
}
