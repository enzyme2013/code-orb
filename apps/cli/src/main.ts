import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { buildFollowUpContext } from "@code-orb/core";
import type { SessionInput, SessionRuntimeState, TurnInput } from "@code-orb/schemas";
import type { StoredSessionArtifact } from "@code-orb/core";

import { getCliUsage, parseCliArgs } from "./commands/run.js";
import { loadEnvFiles } from "./runtime/load-env-file.js";
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
  prompt?(message: string): Promise<string | null>;
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
  prompt: async (message: string) => {
    if (!stdin.isTTY || !stdout.isTTY) {
      return null;
    }

    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await rl.question(message);
      return answer;
    } finally {
      rl.close();
    }
  },
};

export async function main(args: string[] = process.argv.slice(2), io: CliIO = nodeCliIO): Promise<number> {
  const parsed = parseCliArgs(args, io.cwd());
  loadEnvFiles(parsed.command === "invalid" ? io.cwd() : getCommandCwd(parsed, io.cwd()), process.env);

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

    if (parsed.command === "sessions_list") {
      const sessions = await runtime.context.sessionStore.list(parsed.cwd);
      io.stdout.write(formatSessionList(sessions));
      return 0;
    }

    if (parsed.command === "sessions_show") {
      const session = await runtime.context.sessionStore.load(parsed.cwd, parsed.sessionId);

      if (!session) {
        io.stderr.write(`Session not found: ${parsed.sessionId}\n`);
        return 1;
      }

      io.stdout.write(formatSessionDetail(session));
      return 0;
    }

    if (parsed.command === "chat") {
      return await runInteractiveSession(parsed.sessionInput, runtime.runner, runtime.context, io);
    }

    if (parsed.command === "run") {
      const followUpSessionId =
        typeof parsed.sessionInput.metadata?.followUpSessionId === "string"
          ? parsed.sessionInput.metadata.followUpSessionId
          : undefined;

      if (followUpSessionId) {
        const priorSession = await runtime.context.sessionStore.load(parsed.sessionInput.cwd, followUpSessionId);

        if (!priorSession) {
          io.stderr.write(`Session not found: ${followUpSessionId}\n`);
          return 1;
        }

        parsed.sessionInput.metadata = {
          ...parsed.sessionInput.metadata,
          followUpContext: buildFollowUpContext(priorSession),
        };
      }
    }

    await runtime.runner.run(parsed.sessionInput, runtime.context);
    return 0;
  } catch (error) {
    io.stderr.write(`Code Orb failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    return 1;
  }
}

async function runInteractiveSession(
  sessionInput: SessionInput,
  runner: ReturnType<typeof createCliRuntime>["runner"],
  context: ReturnType<typeof createCliRuntime>["context"],
  io: CliIO,
): Promise<number> {
  if (!io.prompt) {
    io.stderr.write("Interactive mode requires prompt-capable CLI IO.\n");
    return 1;
  }

  const session = runner.createSession(sessionInput);
  io.stdout.write("Interactive session started. Type /help for commands.\n");

  let finalReportProduced = false;

  try {
    while (true) {
      const answer = await io.prompt("orb> ");

      if (answer === null) {
        io.stdout.write("Interactive session ended: end of input.\n");
        break;
      }

      const input = answer.trim();
      if (!input) {
        continue;
      }

      if (input === "/help") {
        io.stdout.write(formatInteractiveHelp());
        continue;
      }

      if (input === "/status") {
        io.stdout.write(formatInteractiveStatus(session));
        continue;
      }

      if (isExitCommand(input)) {
        io.stdout.write("Interactive session exiting.\n");
        break;
      }

      await runner.runTurn(session, createInteractiveTurnInput(input), context);
    }

    await runner.completeSession(session, context);
    return 0;
  } catch (error) {
    if (!finalReportProduced) {
      await runner.failSession(session, context, error);
    }

    io.stderr.write(`Code Orb failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    return 1;
  }
}

function createInteractiveTurnInput(content: string): TurnInput {
  return {
    content,
    source: "user",
  };
}

function formatInteractiveHelp(): string {
  return [
    "Interactive commands:\n",
    "/help   Show interactive help\n",
    "/status Show current session status\n",
    "/exit   Save the session and exit\n",
    "exit    Alias for /exit\n",
    "quit    Alias for /exit\n",
  ].join("");
}

function isExitCommand(input: string): boolean {
  return input === "/exit" || input === "/quit" || input === "exit" || input === "quit";
}

function formatInteractiveStatus(session: SessionRuntimeState): string {
  const lastTurn = session.turns.at(-1)?.report;

  return [
    `Session: ${session.id}\n`,
    `Mode: ${session.interactive ? "interactive" : "one-shot"}\n`,
    `Turns: ${session.turns.length}\n`,
    `Status: ${session.status}\n`,
    `Task: ${session.task}\n`,
    `Last turn: ${lastTurn?.summary ?? "none"}\n`,
  ].join("");
}

function getCommandCwd(parsed: ReturnType<typeof parseCliArgs>, fallbackCwd: string): string {
  switch (parsed.command) {
    case "run":
    case "chat":
      return parsed.sessionInput.cwd;
    case "sessions_list":
    case "sessions_show":
      return parsed.cwd;
    default:
      return fallbackCwd;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

function formatSessionList(sessions: StoredSessionArtifact[]): string {
  if (sessions.length === 0) {
    return "No saved sessions found.\n";
  }

  return [
    "Saved sessions:\n",
    ...sessions.map(
      (session) =>
        `- ${session.sessionId} | ${session.outcome} | ${session.savedAt} | ${session.task.replace(/\s+/g, " ").trim()}\n`,
    ),
  ].join("");
}

function formatSessionDetail(session: StoredSessionArtifact): string {
  return [
    `Session: ${session.sessionId}\n`,
    `Outcome: ${session.outcome}\n`,
    `Task: ${session.task}\n`,
    `Cwd: ${session.cwd}\n`,
    `Started: ${session.startedAt}\n`,
    `Ended: ${session.endedAt ?? "n/a"}\n`,
    `Saved: ${session.savedAt}\n`,
    `Artifact: ${session.artifactPath}\n`,
    `Follow-up from: ${session.followUpFromSessionId ?? "none"}\n`,
    `Summary: ${session.summary}\n`,
    ...(session.notes?.map((note) => `Note: ${note}\n`) ?? []),
    ...(session.projectInstructions?.map((instruction) => `Project instructions: ${instruction.path}\n`) ?? []),
    ...(session.mutatingActions?.map((action) =>
      `Mutation ${action.status}: ${action.toolName}${action.path ? ` (${action.path})` : action.command ? ` (${action.command})` : ""}\n`,
    ) ?? []),
    ...(session.changedFiles.length > 0 ? session.changedFiles.map((path) => `Changed: ${path}\n`) : ["Changed: none\n"]),
    ...(session.validations.length > 0
      ? session.validations.map((validation) => `Validation ${validation.status}: ${validation.name}\n`)
      : ["Validations: none\n"]),
    ...(session.risks.length > 0 ? session.risks.map((risk) => `Risk: ${risk}\n`) : ["Risks: none\n"]),
    ...formatSessionGitState(session),
  ].join("");
}

function formatSessionGitState(session: StoredSessionArtifact): string[] {
  if (!session.gitSnapshotBefore && !session.gitSnapshotAfter) {
    return [];
  }

  return [
    session.gitSnapshotBefore?.branch ? `Repository branch before: ${session.gitSnapshotBefore.branch}\n` : "",
    session.gitSnapshotAfter?.branch ? `Repository branch after: ${session.gitSnapshotAfter.branch}\n` : "",
    `Repository dirty before run: ${session.gitSnapshotBefore?.isDirty ? "yes" : "no"}\n`,
    `Repository dirty after run: ${session.gitSnapshotAfter?.isDirty ? "yes" : "no"}\n`,
    ...(session.changeClassification?.preExistingChangedFiles.map((path) => `Pre-existing change: ${path}\n`) ?? []),
    ...(session.changeClassification?.currentRunChangedFiles.map((path) => `Current-run change: ${path}\n`) ?? []),
    ...(session.changeClassification?.touchedPreExistingFiles.map((path) => `Touched pre-existing file: ${path}\n`) ?? []),
  ];
}
