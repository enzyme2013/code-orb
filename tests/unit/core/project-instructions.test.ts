import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadProjectInstructions } from "@code-orb/core";

describe("project instruction loading", () => {
  it("returns no instructions when the working tree does not define AGENTS.md", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-project-instructions-"));

    try {
      await expect(loadProjectInstructions(cwd)).resolves.toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("loads AGENTS.md from the nearest ancestor directory and keeps the repository-relative path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-project-instructions-"));
    const nested = join(cwd, "packages", "core");

    try {
      await mkdir(nested, { recursive: true });
      await writeFile(join(cwd, "AGENTS.md"), "# Repo Rules\n\n- Keep diffs focused.\n", "utf8");

      await expect(loadProjectInstructions(nested)).resolves.toEqual([
        {
          path: "AGENTS.md",
          source: "repository",
          content: "# Repo Rules\n\n- Keep diffs focused.\n",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
