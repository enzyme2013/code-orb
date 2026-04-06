import type { RepositoryChangeClassification } from "@code-orb/schemas";
import type { GitWorkingTreeSnapshot } from "@code-orb/schemas";

export function classifyRepositoryChanges(
  before?: GitWorkingTreeSnapshot,
  after?: GitWorkingTreeSnapshot,
  currentRunFiles: string[] = [],
): RepositoryChangeClassification | undefined {
  if (!before || !after || !before.isGitRepository || !after.isGitRepository) {
    return undefined;
  }

  const preExisting = collectChangedFiles(before);
  const current = new Set(currentRunFiles.filter((filePath) => collectChangedFiles(after).has(filePath)));
  const touchedPreExisting = intersect(preExisting, current);

  return {
    preExistingChangedFiles: [...preExisting].sort(),
    currentRunChangedFiles: [...current].sort(),
    touchedPreExistingFiles: [...touchedPreExisting].sort(),
  };
}

function collectChangedFiles(snapshot: GitWorkingTreeSnapshot): Set<string> {
  return new Set([...snapshot.stagedFiles, ...snapshot.unstagedFiles, ...snapshot.untrackedFiles]);
}

function intersect(left: Set<string>, right: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const value of left) {
    if (right.has(value)) {
      result.add(value);
    }
  }

  return result;
}
