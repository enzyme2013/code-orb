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
}

export const nodeCliIO: CliIO = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: () => process.cwd(),
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

  const runtime = createCliRuntime(io);

  try {
    await runtime.runner.run(parsed.sessionInput, runtime.context);
    return 0;
  } catch {
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
