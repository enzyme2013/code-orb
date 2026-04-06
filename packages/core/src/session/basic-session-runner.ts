import type {
  GitWorkingTreeSnapshot,
  SessionArtifact,
  SessionInput,
  SessionMetadata,
  SessionOutcome,
  SessionReport,
  SessionRuntimeState,
  TurnInput,
  TurnReport,
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
      interactive: input.interactive ?? false,
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
    await this.startSession(session, context);

    try {
      await this.runTurn(
        session,
        {
          content: input.task,
          source: "user",
        },
        context,
      );

      return await this.completeSession(session, context);
    } catch (error) {
      await this.failSession(session, context, error);
      throw error;
    }
  }

  async runTurn(session: SessionRuntimeState, input: TurnInput, context: SessionRunnerContext): Promise<TurnReport> {
    await this.ensureSessionStarted(session, context);

    const turn = this.createTurn(session, input);
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
      const report = await context.agentEngine.runTurn(turn, this.createAgentExecutionContext(session, context));
      turn.report = report;

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

      session.status = "running";

      return report;
    } catch (error) {
      turn.status = "failed";
      turn.endedAt = createTimestamp();
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

      turn.report = {
        sessionId: session.id,
        turnId: turn.id,
        outcome: "failed",
        summary: failureMessage,
        risks: [failureMessage],
      };
      session.status = "failed";
      throw error;
    }
  }

  async completeSession(session: SessionRuntimeState, context: SessionRunnerContext): Promise<SessionReport> {
    await this.ensureSessionStarted(session, context);

    session.endedAt = createTimestamp();

    const sessionReport = this.createSessionReport(session);
    session.status = finalizeSessionStatusValue(sessionReport.outcome);
    const gitSnapshotAfter = await context.gitStateReader.readSnapshot(session.cwd);
    sessionReport.repositoryState = this.createRepositoryStateReport(
      sessionReport,
      session.gitSnapshotBefore,
      gitSnapshotAfter,
    );

    const storedArtifact = await context.sessionStore.save(
      this.createSessionArtifact(session, sessionReport, session.gitSnapshotBefore, gitSnapshotAfter),
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

  private async startSession(session: SessionRuntimeState, context: SessionRunnerContext): Promise<void> {
    if (session.status !== "idle") {
      return;
    }

    session.gitSnapshotBefore = await context.gitStateReader.readSnapshot(session.cwd);
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
  }

  private async ensureSessionStarted(session: SessionRuntimeState, context: SessionRunnerContext): Promise<void> {
    if (session.status === "idle") {
      await this.startSession(session, context);
    }
  }

  private createSessionReport(session: SessionRuntimeState): SessionReport {
    const turnReports = session.turns.flatMap((turn) => (turn.report ? [turn.report] : []));
    const latestTurnReport = turnReports[turnReports.length - 1];
    const summary = latestTurnReport?.summary ?? session.task;

    return {
      sessionId: session.id,
      outcome: latestTurnReport ? deriveSessionOutcome(latestTurnReport.outcome) : finalizeSessionOutcome(session.status),
      summary,
      turnReports,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      followUpFromSessionId: getFollowUpFromSessionId(session.metadata),
    };
  }

  async failSession(session: SessionRuntimeState, context: SessionRunnerContext, error: unknown): Promise<SessionReport> {
    session.status = "failed";
    session.endedAt = createTimestamp();
    const failureMessage = error instanceof Error ? error.message : "Unknown error";
    const gitSnapshotAfter = await context.gitStateReader.readSnapshot(session.cwd);
    const sessionReport = this.createFailedSessionReport(
      session,
      session.turns[session.turns.length - 1]?.id,
      failureMessage,
      getFollowUpFromSessionId(session.metadata),
    );

    sessionReport.repositoryState = this.createRepositoryStateReport(sessionReport, session.gitSnapshotBefore, gitSnapshotAfter);
    const storedArtifact = await context.sessionStore.save(
      this.createSessionArtifact(session, sessionReport, session.gitSnapshotBefore, gitSnapshotAfter),
    );
    sessionReport.artifactPath = storedArtifact.artifactPath;

    return sessionReport;
  }

  private createFailedSessionReport(
    session: SessionRuntimeState,
    turnId: string | undefined,
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
          turnId: turnId ?? createRuntimeId("turn"),
          outcome: "failed",
          summary: message,
          risks: [message],
        },
      ],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }

  private createAgentExecutionContext(session: SessionRuntimeState, context: SessionRunnerContext): AgentExecutionContext {
    return {
      cwd: session.cwd,
      defaultProfile: "default",
      eventSink: context.eventSink,
      modelClient: context.modelClient,
      toolExecutor: context.toolExecutor,
      policyEngine: context.policyEngine,
      approvalResolver: context.approvalResolver,
      followUpContext: this.resolveFollowUpContext(session),
    };
  }

  private resolveFollowUpContext(session: SessionRuntimeState): SessionMetadata["followUpContext"] {
    const explicitFollowUp = session.metadata?.followUpContext;

    if (explicitFollowUp) {
      return explicitFollowUp;
    }

    const previousTurn = session.turns.at(-2)?.report;
    if (!previousTurn) {
      return undefined;
    }

    return {
      priorSessionId: session.id,
      priorTask: session.task,
      priorOutcome: deriveSessionOutcome(previousTurn.outcome),
      priorSummary: previousTurn.summary,
      priorChangedFiles: previousTurn.filesChanged ?? [],
      priorValidations: previousTurn.validations ?? [],
      priorRisks: previousTurn.risks ?? [],
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

function finalizeSessionOutcome(status: SessionRuntimeState["status"]): SessionOutcome {
  if (status === "failed") {
    return "failed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "completed";
}

function finalizeSessionStatusValue(outcome: SessionOutcome): SessionRuntimeState["status"] {
  if (outcome === "failed") {
    return "failed";
  }

  if (outcome === "cancelled") {
    return "cancelled";
  }

  return "completed";
}

function getFollowUpFromSessionId(metadata: SessionMetadata | undefined): string | undefined {
  return metadata?.followUpContext?.priorSessionId;
}
