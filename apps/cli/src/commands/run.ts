import type { SessionInput } from "@code-orb/schemas";

export interface RunCommandRequest {
  command: "run";
  sessionInput: SessionInput;
}

export interface ChatCommandRequest {
  command: "chat";
  sessionInput: SessionInput;
}

export interface SessionsListCommandRequest {
  command: "sessions_list";
  cwd: string;
}

export interface SessionsShowCommandRequest {
  command: "sessions_show";
  cwd: string;
  sessionId: string;
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

export type ParsedCliCommand =
  | RunCommandRequest
  | ChatCommandRequest
  | SessionsListCommandRequest
  | SessionsShowCommandRequest
  | HelpCommandResult
  | InvalidCommandResult;

const USAGE = `Usage:
  orb --cwd <path> run "<task>"
  orb --cwd <path> chat
  orb chat
  orb run --from-session <session-id> "<task>"
  orb run "<task>"
  orb sessions list
  orb sessions show <session-id>
  orb help

Examples:
  pnpm run cli:run -- --cwd benchmarks/failing-test-fix/repo run "Fix the failing test without changing the intended behavior."
  pnpm run cli:run -- chat
  pnpm run cli:run -- run --from-session ses_123 "Continue from the prior result and add verification."
  pnpm run cli:run -- sessions list
  pnpm run cli:run -- sessions show ses_123
  pnpm run benchmark:failing-test-fix

Environment:
  .env / .env.local  Optional local files loaded from the active cwd
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
    if (command === "chat") {
      return {
        command: "chat",
        sessionInput: {
          cwd: workingDirectory,
          task: "Interactive CLI session",
          interactive: true,
        },
      };
    }

    if (command === "sessions") {
      const [subcommand, ...sessionArgs] = rest;

      if (subcommand === "list") {
        return {
          command: "sessions_list",
          cwd: workingDirectory,
        };
      }

      if (subcommand === "show") {
        const sessionId = sessionArgs[0]?.trim();

        if (!sessionId) {
          return {
            command: "invalid",
            message: "Missing session id for `orb sessions show`.",
            usage: USAGE,
          };
        }

        return {
          command: "sessions_show",
          cwd: workingDirectory,
          sessionId,
        };
      }

      return {
        command: "invalid",
        message: "Expected `orb sessions list` or `orb sessions show <session-id>`.",
        usage: USAGE,
      };
    }

    return {
      command: "invalid",
      message: `Unknown command: ${command}`,
      usage: USAGE,
    };
  }

  let taskArgs = rest;
  let followUpSessionId: string | undefined;

  if (rest[0] === "--from-session") {
    followUpSessionId = rest[1]?.trim();

    if (!followUpSessionId) {
      return {
        command: "invalid",
        message: "Missing session id after --from-session.",
        usage: USAGE,
      };
    }

    taskArgs = rest.slice(2);
  }

  const task = taskArgs.join(" ").trim();

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
      metadata: followUpSessionId
        ? {
            followUpSessionId,
          }
        : undefined,
    },
  };
}
