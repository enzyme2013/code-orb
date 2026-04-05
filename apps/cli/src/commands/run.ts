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
  orb run "<task>"
`;

export function getCliUsage(): string {
  return USAGE;
}

export function parseCliArgs(args: string[], cwd: string): ParsedCliCommand {
  const [command, ...rest] = args;

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
      cwd,
      task,
    },
  };
}
