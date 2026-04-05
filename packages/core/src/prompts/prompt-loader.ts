import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const promptCache = new Map<string, string>();
let promptsRootPromise: Promise<string> | undefined;

export async function loadPromptAsset(relativePath: string): Promise<string> {
  const promptsRoot = await getPromptsRoot();
  const promptPath = join(promptsRoot, relativePath);

  if (promptCache.has(promptPath)) {
    return promptCache.get(promptPath) ?? "";
  }

  const content = await readFile(promptPath, "utf8");
  promptCache.set(promptPath, content);
  return content;
}

async function getPromptsRoot(): Promise<string> {
  promptsRootPromise ??= findPromptsRoot(dirname(fileURLToPath(import.meta.url)));
  return promptsRootPromise;
}

async function findPromptsRoot(startDir: string): Promise<string> {
  let current = startDir;

  while (true) {
    const candidate = join(current, "prompts");

    try {
      await access(join(candidate, "system", "base.md"));
      return candidate;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        throw new Error("Could not locate the prompts directory.");
      }

      current = parent;
    }
  }
}
