import { getCliUsage, parseCliArgs } from "./commands/run.js";

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

  io.stdout.write(`Accepted run command for task: ${parsed.sessionInput.task}\n`);
  io.stdout.write("Phase 1 CLI contract established; runtime wiring continues in Phase 2.\n");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
