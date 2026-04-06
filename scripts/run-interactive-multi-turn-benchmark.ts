import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { main } from "../apps/cli/src/main.js";

const benchmarkRoot = resolve("benchmarks/interactive-multi-turn/repo");
const tempParent = resolve(".tmp-benchmarks");

void mainEntry();

async function mainEntry(): Promise<void> {
  await mkdir(tempParent, { recursive: true });

  const tempRoot = await mkdtemp(join(tempParent, "interactive-multi-turn-"));

  try {
    await cp(benchmarkRoot, tempRoot, { recursive: true });

    const stdout: string[] = [];
    const stderr: string[] = [];
    const promptInputs: Array<string | null> = [
      'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      "continue the prior work",
      "/exit",
    ];

    const exitCode = await main(["--cwd", tempRoot, "chat"], {
      stdout: {
        write(message: string) {
          stdout.push(message);
          process.stdout.write(message);
        },
      },
      stderr: {
        write(message: string) {
          stderr.push(message);
          process.stderr.write(message);
        },
      },
      cwd: () => tempRoot,
      confirm: async () => true,
      prompt: async () => promptInputs.shift() ?? null,
    });

    const readme = await readFile(join(tempRoot, "README.md"), "utf8");
    const sessions = await readdir(join(tempRoot, ".orb", "sessions"));

    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }

    if (!readme.includes("Hello, Code Orb!")) {
      throw new Error("Interactive benchmark did not update README.md.");
    }

    if (sessions.filter((entry) => entry.endsWith(".json")).length !== 1) {
      throw new Error("Interactive benchmark expected exactly one session artifact.");
    }

    if (!stdout.join("").includes("Turn 2: continue the prior work")) {
      throw new Error("Interactive benchmark did not complete the second turn.");
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
