import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { LoadedProjectInstruction, ProjectInstructionSource } from "@code-orb/schemas";

const PROJECT_INSTRUCTION_FILES = ["AGENTS.md"] as const;

interface DiscoveredProjectInstruction {
  absolutePath: string;
  relativePath: string;
}

export async function loadProjectInstructions(cwd: string): Promise<LoadedProjectInstruction[]> {
  const discovered = await discoverProjectInstructions(cwd);
  const loaded: LoadedProjectInstruction[] = [];

  for (const instruction of discovered) {
    const content = await readFile(instruction.absolutePath, "utf8");

    if (!content.trim()) {
      continue;
    }

    loaded.push({
      path: instruction.relativePath,
      source: "repository",
      content,
    });
  }

  return loaded;
}

export function toProjectInstructionSources(
  instructions: Pick<LoadedProjectInstruction, "path" | "source">[] | undefined,
): ProjectInstructionSource[] | undefined {
  if (!instructions || instructions.length === 0) {
    return undefined;
  }

  return instructions.map((instruction) => ({
    path: instruction.path,
    source: instruction.source,
  }));
}

async function discoverProjectInstructions(startDir: string): Promise<DiscoveredProjectInstruction[]> {
  let current = startDir;

  while (true) {
    const discovered: DiscoveredProjectInstruction[] = [];

    for (const filename of PROJECT_INSTRUCTION_FILES) {
      const absolutePath = join(current, filename);

      if (await fileExists(absolutePath)) {
        discovered.push({
          absolutePath,
          relativePath: filename,
        });
      }
    }

    if (discovered.length > 0) {
      return discovered.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    }

    const parent = dirname(current);
    if (parent === current) {
      return [];
    }

    current = parent;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
