import type {
  SessionInput,
  SessionOutcome,
  SessionReport,
  SessionRuntimeState,
  TurnInput,
  TurnRuntimeState,
} from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
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
      };

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

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: session.id,
        turnId: turn.id,
        type: "error.raised",
        timestamp: createTimestamp(),
        payload: {
          code: "session_run_failed",
          message: error instanceof Error ? error.message : "Unknown error",
          retryable: false,
        },
      });

      throw error;
    }
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
