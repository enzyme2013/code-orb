import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalGitStateReader, parseGitStatusPorcelain } from "../../../packages/core/src/index";

import { ensureGitRepository, runGit } from "../../helpers/git";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("LocalGitStateReader", () => {
  it("returns a non-git snapshot for ordinary directories", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-git-reader-"));
    tempDirs.push(cwd);

    const snapshot = await new LocalGitStateReader().readSnapshot(cwd);

    expect(snapshot).toEqual({
      isGitRepository: false,
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
      isDirty: false,
    });
  });

  it("captures branch and working-tree file categories for git-backed directories", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-git-reader-"));
    tempDirs.push(cwd);

    await ensureGitRepository(cwd);
    await writeFile(join(cwd, "staged-only.txt"), "staged\n", "utf8");
    await writeFile(join(cwd, "staged-and-unstaged.txt"), "first\n", "utf8");
    await runGit(["add", "staged-only.txt", "staged-and-unstaged.txt"], cwd);
    await writeFile(join(cwd, "staged-and-unstaged.txt"), "second\n", "utf8");
    await writeFile(join(cwd, "untracked.txt"), "untracked\n", "utf8");

    const snapshot = await new LocalGitStateReader().readSnapshot(cwd);

    expect(snapshot.isGitRepository).toBe(true);
    expect(snapshot.branch).toBeTruthy();
    expect(snapshot.stagedFiles).toEqual(["staged-and-unstaged.txt", "staged-only.txt"]);
    expect(snapshot.unstagedFiles).toEqual(["staged-and-unstaged.txt"]);
    expect(snapshot.untrackedFiles).toEqual(["untracked.txt"]);
    expect(snapshot.isDirty).toBe(true);
  });

  it("parses rename entries to the current path", () => {
    const snapshot = parseGitStatusPorcelain(["## main", "R  old-name.ts -> new-name.ts"].join("\n"));

    expect(snapshot.stagedFiles).toEqual(["new-name.ts"]);
    expect(snapshot.unstagedFiles).toEqual([]);
  });
});
