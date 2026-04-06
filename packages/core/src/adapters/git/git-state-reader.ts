import { spawn } from "node:child_process";

import type { GitWorkingTreeSnapshot } from "@code-orb/schemas";

export interface GitStateReader {
  readSnapshot(cwd: string): Promise<GitWorkingTreeSnapshot>;
}

export class LocalGitStateReader implements GitStateReader {
  async readSnapshot(cwd: string): Promise<GitWorkingTreeSnapshot> {
    const insideWorkTree = await runGitCommand(["rev-parse", "--is-inside-work-tree"], cwd);

    if (insideWorkTree.exitCode !== 0 || insideWorkTree.stdout.trim() !== "true") {
      return createNonGitSnapshot();
    }

    const status = await runGitCommand(["status", "--porcelain", "--branch"], cwd);

    if (status.exitCode !== 0) {
      throw new Error(status.stderr.trim() || "Failed to read git working tree state.");
    }

    return parseGitStatusPorcelain(status.stdout);
  }
}

export function parseGitStatusPorcelain(output: string): GitWorkingTreeSnapshot {
  const lines = output.split(/\r?\n/).filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      isGitRepository: true,
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
      isDirty: false,
    };
  }

  const branch = parseBranchLine(lines[0]);
  const stagedFiles = new Set<string>();
  const unstagedFiles = new Set<string>();
  const untrackedFiles = new Set<string>();

  for (const line of lines.slice(1)) {
    if (line.startsWith("?? ")) {
      untrackedFiles.add(normalizeStatusPath(line.slice(3)));
      continue;
    }

    if (line.length < 4) {
      continue;
    }

    const stagedCode = line[0];
    const unstagedCode = line[1];
    const path = normalizeStatusPath(line.slice(3));

    if (stagedCode !== " ") {
      stagedFiles.add(path);
    }

    if (unstagedCode !== " ") {
      unstagedFiles.add(path);
    }
  }

  const staged = [...stagedFiles].sort();
  const unstaged = [...unstagedFiles].sort();
  const untracked = [...untrackedFiles].sort();

  return {
    isGitRepository: true,
    branch,
    stagedFiles: staged,
    unstagedFiles: unstaged,
    untrackedFiles: untracked,
    isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
  };
}

function createNonGitSnapshot(): GitWorkingTreeSnapshot {
  return {
    isGitRepository: false,
    stagedFiles: [],
    unstagedFiles: [],
    untrackedFiles: [],
    isDirty: false,
  };
}

function parseBranchLine(line: string): string | undefined {
  if (!line.startsWith("## ")) {
    return undefined;
  }

  const branchInfo = line.slice(3).trim();

  if (branchInfo.startsWith("No commits yet on ")) {
    return branchInfo.slice("No commits yet on ".length).trim() || undefined;
  }

  if (branchInfo.startsWith("HEAD ")) {
    return undefined;
  }

  return branchInfo.split("...")[0]?.trim() || undefined;
}

function normalizeStatusPath(path: string): string {
  const trimmed = path.trim();
  const renameSeparator = " -> ";

  if (!trimmed.includes(renameSeparator)) {
    return trimmed;
  }

  return trimmed.split(renameSeparator).at(-1)?.trim() ?? trimmed;
}

async function runGitCommand(args: string[], cwd: string): Promise<{
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

    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({ stdout: "", stderr: "git not available", exitCode: 1 });
        return;
      }

      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      });
    });
  });
}
