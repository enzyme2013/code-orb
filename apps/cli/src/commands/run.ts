import type { SessionInput } from "@code-orb/schemas";

export interface RunCommandRequest {
  command: "run";
  sessionInput: SessionInput;
}

export interface HelpCommandResult {
  command: "help";
  usage: string;
}

export interface InvalidCommandResult {
  command: "invalid";
  message: string;
  usage: string;
}

export type ParsedCliCommand = RunCommandRequest | HelpCommandResult | InvalidCommandResult;

const USAGE = `Usage:
  orb --cwd <path> run "<task>"
  orb run "<task>"
  orb help

Examples:
  pnpm run cli:run -- --cwd benchmarks/failing-test-fix/repo run "Fix the failing test without changing the intended behavior."
  pnpm run benchmark:failing-test-fix

Environment:
  OPENAI_API_KEY   Required with OPENAI_MODEL to use a real provider
  OPENAI_MODEL     Required with OPENAI_API_KEY to use a real provider
  OPENAI_BASE_URL  Optional override for OpenAI-compatible endpoints

If no provider environment is configured, Code Orb falls back to the mock model client.
`;

export function getCliUsage(): string {
  return USAGE;
}

export function parseCliArgs(args: string[], cwd: string): ParsedCliCommand {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  let workingDirectory = cwd;
  let startIndex = 0;

  if (normalizedArgs[0] === "--cwd") {
    const candidate = normalizedArgs[1];

    if (!candidate) {
      return {
        command: "invalid",
        message: "Missing path after --cwd.",
        usage: USAGE,
      };
    }

    workingDirectory = candidate;
    startIndex = 2;
  }

  const [command, ...rest] = normalizedArgs.slice(startIndex);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return {
      command: "help",
      usage: USAGE,
    };
  }

  if (command !== "run") {
    return {
      command: "invalid",
      message: `Unknown command: ${command}`,
      usage: USAGE,
    };
  }

  const task = rest.join(" ").trim();

  if (!task) {
    return {
      command: "invalid",
      message: "Missing task for `orb run`.",
      usage: USAGE,
    };
  }

  return {
    command: "run",
    sessionInput: {
      cwd: workingDirectory,
      task,
    },
  };
}
