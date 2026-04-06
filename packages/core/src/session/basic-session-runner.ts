import type {
  GitWorkingTreeSnapshot,
  SessionArtifact,
  SessionInput,
  SessionOutcome,
  SessionReport,
  SessionRuntimeState,
  TurnInput,
  TurnRuntimeState,
} from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import { classifyRepositoryChanges } from "./change-classifier.js";
import type { AgentExecutionContext } from "../engine/agent-engine.js";
import type { SessionRunner, SessionRunnerContext } from "./session-runner.js";

export class BasicSessionRunner implements SessionRunner {
  createSession(input: SessionInput): SessionRuntimeState {
    return {
      id: createRuntimeId("ses"),
      cwd: input.cwd,
      task: input.task,
      status: "idle",
      startedAt: createTimestamp(),
      turns: [],
      metadata: input.metadata,
    };
  }

  createTurn(session: SessionRuntimeState, input: TurnInput): TurnRuntimeState {
    return {
      id: createRuntimeId("turn"),
      sessionId: session.id,
      index: session.turns.length,
      status: "pending",
      input,
      startedAt: createTimestamp(),
      steps: [],
    };
  }

  async run(input: SessionInput, context: SessionRunnerContext): Promise<SessionReport> {
    const session = this.createSession(input);
    const gitSnapshotBefore = await context.gitStateReader.readSnapshot(input.cwd);
    session.status = "running";

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: session.id,
      type: "session.started",
      timestamp: createTimestamp(),
      payload: {
        task: session.task,
        cwd: session.cwd,
      },
    });

    const turn = this.createTurn(session, {
      content: input.task,
      source: "user",
    });

    session.turns.push(turn);
    turn.status = "running";

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: session.id,
      turnId: turn.id,
      type: "turn.started",
      timestamp: createTimestamp(),
      payload: {
        index: turn.index,
        input: turn.input.content,
      },
    });

    try {
      const report = await context.agentEngine.runTurn(turn, this.createAgentExecutionContext(input, context));

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: session.id,
        turnId: turn.id,
        type: "turn.completed",
        timestamp: createTimestamp(),
        payload: {
          report,
        },
      });

      const sessionOutcome = deriveSessionOutcome(report.outcome);
      session.status = sessionOutcome === "failed" ? "failed" : sessionOutcome === "cancelled" ? "cancelled" : "completed";
      session.endedAt = createTimestamp();

      const sessionReport: SessionReport = {
        sessionId: session.id,
        outcome: sessionOutcome,
        summary: report.summary,
        turnReports: [report],
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        followUpFromSessionId: input.metadata?.followUpContext?.priorSessionId,
      };

      const gitSnapshotAfter = await context.gitStateReader.readSnapshot(input.cwd);
      sessionReport.repositoryState = this.createRepositoryStateReport(
        sessionReport,
        gitSnapshotBefore,
        gitSnapshotAfter,
      );
      const storedArtifact = await context.sessionStore.save(
        this.createSessionArtifact(session, sessionReport, gitSnapshotBefore, gitSnapshotAfter),
      );
      sessionReport.artifactPath = storedArtifact.artifactPath;

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: session.id,
        type: "session.completed",
        timestamp: createTimestamp(),
        payload: {
          report: sessionReport,
        },
      });

      return sessionReport;
    } catch (error) {
      session.status = "failed";
      session.endedAt = createTimestamp();
      const failureMessage = error instanceof Error ? error.message : "Unknown error";

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: session.id,
        turnId: turn.id,
        type: "error.raised",
        timestamp: createTimestamp(),
        payload: {
          code: "session_run_failed",
          message: failureMessage,
          retryable: false,
        },
      });

      const gitSnapshotAfter = await context.gitStateReader.readSnapshot(input.cwd);

      await context.sessionStore.save(
        this.createSessionArtifact(
          session,
          this.createFailedSessionReport(session, turn.id, failureMessage, input.metadata?.followUpContext?.priorSessionId),
          gitSnapshotBefore,
          gitSnapshotAfter,
        ),
      );

      throw error;
    }
  }

  private createSessionArtifact(
    session: SessionRuntimeState,
    report: SessionReport,
    gitSnapshotBefore?: GitWorkingTreeSnapshot,
    gitSnapshotAfter?: GitWorkingTreeSnapshot,
  ): SessionArtifact {
    const changedFiles = new Set<string>();
    const validations: SessionArtifact["validations"] = [];
    const risks = new Set<string>();

    for (const turnReport of report.turnReports) {
      for (const filePath of turnReport.filesChanged ?? []) {
        changedFiles.add(filePath);
      }

      for (const validation of turnReport.validations ?? []) {
        validations.push(validation);
      }

      for (const risk of turnReport.risks ?? []) {
        risks.add(risk);
      }
    }

    return {
      schemaVersion: 1,
      sessionId: session.id,
      task: session.task,
      cwd: session.cwd,
      startedAt: session.startedAt,
      endedAt: report.endedAt,
      savedAt: createTimestamp(),
      outcome: report.outcome,
      followUpFromSessionId: report.followUpFromSessionId,
      summary: report.summary,
      changedFiles: [...changedFiles],
      validations,
      risks: [...risks],
      gitSnapshotBefore,
      gitSnapshotAfter,
      changeClassification: report.repositoryState?.changeClassification,
      turnReports: report.turnReports,
    };
  }

  private createRepositoryStateReport(
    report: SessionReport,
    gitSnapshotBefore?: GitWorkingTreeSnapshot,
    gitSnapshotAfter?: GitWorkingTreeSnapshot,
  ): SessionReport["repositoryState"] {
    if (!gitSnapshotBefore && !gitSnapshotAfter) {
      return undefined;
    }

    const currentRunFiles = this.collectCurrentRunFiles(report);

    return {
      initialBranch: gitSnapshotBefore?.branch,
      finalBranch: gitSnapshotAfter?.branch,
      wasDirtyBeforeRun: gitSnapshotBefore?.isDirty ?? false,
      isDirtyAfterRun: gitSnapshotAfter?.isDirty ?? false,
      snapshotBefore: gitSnapshotBefore,
      snapshotAfter: gitSnapshotAfter,
      changeClassification: classifyRepositoryChanges(gitSnapshotBefore, gitSnapshotAfter, currentRunFiles),
    };
  }

  private collectCurrentRunFiles(report: SessionReport): string[] {
    const files = new Set<string>();

    for (const turnReport of report.turnReports) {
      for (const filePath of turnReport.filesChanged ?? []) {
        files.add(filePath);
      }
    }

    return [...files].sort();
  }

  private createFailedSessionReport(
    session: SessionRuntimeState,
    turnId: string,
    message: string,
    followUpFromSessionId?: string,
  ): SessionReport {
    return {
      sessionId: session.id,
      outcome: "failed",
      summary: message,
      followUpFromSessionId,
      turnReports: [
        {
          sessionId: session.id,
          turnId,
          outcome: "failed",
          summary: message,
          risks: [message],
        },
      ],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }

  private createAgentExecutionContext(input: SessionInput, context: SessionRunnerContext): AgentExecutionContext {
    return {
      cwd: input.cwd,
      defaultProfile: "default",
      eventSink: context.eventSink,
      modelClient: context.modelClient,
      toolExecutor: context.toolExecutor,
      policyEngine: context.policyEngine,
      approvalResolver: context.approvalResolver,
      followUpContext: input.metadata?.followUpContext,
    };
  }
}

function deriveSessionOutcome(turnOutcome: SessionReport["turnReports"][number]["outcome"]): SessionOutcome {
  if (turnOutcome === "failed") {
    return "failed";
  }

  if (turnOutcome === "blocked") {
    return "cancelled";
  }

  return "completed";
}
