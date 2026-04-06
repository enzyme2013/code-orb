import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadEnvFiles } from "../../../apps/cli/src/runtime/load-env-file";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadEnvFiles", () => {
  it("loads provider variables from .env", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-env-test-"));
    tempDirs.push(cwd);
    await writeFile(join(cwd, ".env"), "OPENAI_API_KEY=test-key\nOPENAI_MODEL=gpt-test\n", "utf8");

    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(cwd, env);

    expect(env.OPENAI_API_KEY).toBe("test-key");
    expect(env.OPENAI_MODEL).toBe("gpt-test");
  });

  it("prefers existing shell env values over .env files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-env-test-"));
    tempDirs.push(cwd);
    await writeFile(join(cwd, ".env"), "OPENAI_API_KEY=file-key\nOPENAI_MODEL=file-model\n", "utf8");
    await writeFile(join(cwd, ".env.local"), "OPENAI_MODEL=local-model\n", "utf8");

    const env: NodeJS.ProcessEnv = {
      OPENAI_API_KEY: "shell-key",
    };

    loadEnvFiles(cwd, env);

    expect(env.OPENAI_API_KEY).toBe("shell-key");
    expect(env.OPENAI_MODEL).toBe("file-model");
  });
});
