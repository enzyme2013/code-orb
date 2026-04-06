import { describe, expect, it } from "vitest";

import { classifyRepositoryChanges } from "../../../packages/core/src/index";

describe("classifyRepositoryChanges", () => {
  it("distinguishes pre-existing changes, current-run changes, and touched pre-existing files", () => {
    const classification = classifyRepositoryChanges(
      {
        isGitRepository: true,
        branch: "main",
        stagedFiles: ["README.md"],
        unstagedFiles: ["src/index.ts"],
        untrackedFiles: ["notes.txt"],
        isDirty: true,
      },
      {
        isGitRepository: true,
        branch: "main",
        stagedFiles: ["README.md", "docs/guide.md"],
        unstagedFiles: ["src/index.ts"],
        untrackedFiles: ["notes.txt", "scratch.ts"],
        isDirty: true,
      },
      ["docs/guide.md", "src/index.ts"],
    );

    expect(classification).toEqual({
      preExistingChangedFiles: ["README.md", "notes.txt", "src/index.ts"],
      currentRunChangedFiles: ["docs/guide.md", "src/index.ts"],
      touchedPreExistingFiles: ["src/index.ts"],
    });
  });

  it("returns undefined for non-git snapshots", () => {
    const classification = classifyRepositoryChanges(
      {
        isGitRepository: false,
        stagedFiles: [],
        unstagedFiles: [],
        untrackedFiles: [],
        isDirty: false,
      },
      {
        isGitRepository: false,
        stagedFiles: [],
        unstagedFiles: [],
        untrackedFiles: [],
        isDirty: false,
      },
      [],
    );

    expect(classification).toBeUndefined();
  });
});
