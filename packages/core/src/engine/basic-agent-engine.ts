import type { ModelMessage, StepRuntimeState, TurnPlan, TurnReport, TurnRuntimeState } from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import type { AgentEngine, AgentExecutionContext } from "./agent-engine.js";

export class BasicAgentEngine implements AgentEngine {
  async runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport> {
    const step = await this.runStep(
      {
        id: createRuntimeId("step"),
        sessionId: turn.sessionId,
        turnId: turn.id,
        index: turn.steps.length,
        kind: "planning",
        status: "pending",
        startedAt: createTimestamp(),
        toolCallIds: [],
      },
      context,
    );

    turn.steps.push(step);

    const plan = await this.generatePlan(turn, context);
    turn.plan = plan;
    turn.summary = plan.summary;
    turn.status = "completed";
    turn.endedAt = createTimestamp();

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: step.id,
      type: "plan.generated",
      timestamp: createTimestamp(),
      payload: {
        plan,
        profile: context.defaultProfile,
      },
    });

    return {
      sessionId: turn.sessionId,
      turnId: turn.id,
      outcome: "completed",
      summary: plan.summary,
      nextSteps: plan.items,
    };
  }

  async runStep(step: StepRuntimeState, context: AgentExecutionContext): Promise<StepRuntimeState> {
    const startedAt = createTimestamp();

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: step.sessionId,
      turnId: step.turnId,
      stepId: step.id,
      type: "step.started",
      timestamp: startedAt,
      payload: {
        index: step.index,
        kind: step.kind,
      },
    });

    return {
      ...step,
      status: "completed",
      startedAt,
      endedAt: createTimestamp(),
    };
  }

  private async generatePlan(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnPlan> {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: turn.input.content,
      },
    ];

    const response = await context.modelClient.complete({
      sessionId: turn.sessionId,
      turnId: turn.id,
      profile: context.defaultProfile,
      messages,
    });

    const summary = response.content.trim() || `Handled turn: ${turn.input.content}`;

    return {
      summary,
      items: [
        {
          id: createRuntimeId("plan"),
          content: `Review response from ${response.provider}/${response.model}`,
          status: "pending",
        },
      ],
    };
  }
}
