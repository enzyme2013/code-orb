import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { getCliUsage, parseCliArgs } from "./commands/run.js";
import { createCliRuntime } from "./runtime/create-cli-runtime.js";

export interface CliIO {
  readonly stdout: {
    write(message: string): void;
  };
  readonly stderr: {
    write(message: string): void;
  };
  cwd(): string;
  confirm?(message: string): Promise<boolean>;
}

export const nodeCliIO: CliIO = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: () => process.cwd(),
  confirm: async (message: string) => {
    if (process.env.CODE_ORB_AUTO_APPROVE === "1") {
      return true;
    }

    if (process.env.CODE_ORB_BENCHMARK_REJECT_APPROVAL === "1") {
      return false;
    }

    if (!stdin.isTTY || !stdout.isTTY) {
      throw new Error(
        "Mutating actions require interactive approval. Re-run in a TTY or set CODE_ORB_AUTO_APPROVE=1.",
      );
    }

    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await rl.question(`${message} [y/N] `);
      return /^y(es)?$/i.test(answer.trim());
    } finally {
      rl.close();
    }
  },
};

export async function main(args: string[] = process.argv.slice(2), io: CliIO = nodeCliIO): Promise<number> {
  const parsed = parseCliArgs(args, io.cwd());

  if (parsed.command === "help") {
    io.stdout.write(parsed.usage);
    return 0;
  }

  if (parsed.command === "invalid") {
    io.stderr.write(`${parsed.message}\n\n${parsed.usage}`);
    return 1;
  }

  try {
    const runtime = createCliRuntime(io);
    await runtime.runner.run(parsed.sessionInput, runtime.context);
    return 0;
  } catch (error) {
    io.stderr.write(`Code Orb failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
