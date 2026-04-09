import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

export interface SearchMatch {
  path: string;
  line: number;
  preview: string;
}

export class BuiltinToolError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BuiltinToolError";
  }
}

const DEFAULT_IGNORES = new Set([".git", ".orb", "node_modules", "dist", "coverage"]);

export function resolveRepoPath(cwd: string, targetPath: string): string {
  return resolve(cwd, targetPath);
}

export function isPathWithinCwd(cwd: string, targetPath: string): boolean {
  const rel = relative(cwd, targetPath);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
}

export async function listRepositoryFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];

  await walkDirectory(cwd, cwd, files);

  return files.sort();
}

async function walkDirectory(root: string, current: string, files: string[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) {
      continue;
    }

    const absolutePath = resolve(current, entry.name);
    const relativePath = relative(root, absolutePath);

    if (entry.isDirectory()) {
      await walkDirectory(root, absolutePath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

export async function readRepositoryFile(cwd: string, targetPath: string): Promise<string> {
  const absolutePath = resolveRepoPath(cwd, targetPath);

  if (!isPathWithinCwd(cwd, absolutePath)) {
    throw new BuiltinToolError(`Path is outside the repository: ${targetPath}`, "path_outside_repo", {
      path: targetPath,
    });
  }

  return readFile(absolutePath, "utf8");
}

export async function searchRepositoryText(cwd: string, query: string): Promise<SearchMatch[]> {
  const files = await listRepositoryFiles(cwd);
  const matches: SearchMatch[] = [];

  for (const path of files) {
    const absolutePath = resolveRepoPath(cwd, path);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.includes(query)) {
        matches.push({
          path,
          line: index + 1,
          preview: line,
        });
      }
    });
  }

  return matches;
}

export async function replaceInRepositoryFile(
  cwd: string,
  targetPath: string,
  searchText: string,
  replaceText: string,
): Promise<{ path: string; replaced: boolean; created?: boolean }> {
  const absolutePath = resolveRepoPath(cwd, targetPath);

  if (!isPathWithinCwd(cwd, absolutePath)) {
    throw new BuiltinToolError(`Path is outside the repository: ${targetPath}`, "path_outside_repo", {
      path: targetPath,
    });
  }

  let content: string;

  try {
    content = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      if (searchText !== "") {
        throw new BuiltinToolError(`Search text not found in ${targetPath}`, "edit_target_not_found", {
          path: targetPath,
          searchText,
        });
      }

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, replaceText, "utf8");

      return {
        path: targetPath,
        replaced: true,
        created: true,
      };
    }

    throw error;
  }

  if (searchText === "") {
    await writeFile(absolutePath, replaceText, "utf8");

    return {
      path: targetPath,
      replaced: replaceText !== content,
    };
  }

  if (!content.includes(searchText)) {
    throw new BuiltinToolError(`Search text not found in ${targetPath}`, "edit_target_not_found", {
      path: targetPath,
      searchText,
    });
  }

  const updated = content.replace(searchText, replaceText);
  await writeFile(absolutePath, updated, "utf8");

  return {
    path: targetPath,
    replaced: updated !== content,
  };
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
