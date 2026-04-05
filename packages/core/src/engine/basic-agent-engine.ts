import type {
  ModelMessage,
  StepKind,
  StepRuntimeState,
  ToolCallRequest,
  TurnPlan,
  TurnReport,
  TurnRuntimeState,
  ValidationResult,
} from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import type { SearchMatch } from "../tools/builtin-tool-helpers.js";
import type { AgentEngine, AgentExecutionContext } from "./agent-engine.js";

export class BasicAgentEngine implements AgentEngine {
  async runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport> {
    const planningStep = await this.startStep(turn, "planning", context);

    const plan = await this.generatePlan(turn, context);
    turn.plan = plan;
    turn.summary = plan.summary;

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: planningStep.id,
      type: "plan.generated",
      timestamp: createTimestamp(),
      payload: {
        plan,
        profile: context.defaultProfile,
      },
    });

    this.completeStep(turn, planningStep.id);

    const execution = await this.tryExecuteReplaceAndVerifyTask(turn, context);
    const validations = execution.validation ? [execution.validation] : undefined;
    const filesChanged = execution.changedFile ? [execution.changedFile] : undefined;
    const risks =
      execution.validation?.status === "failed"
        ? ["Verification command failed."]
        : execution.validation
          ? []
          : ["No verification command was run."];

    turn.status = "completed";
    turn.endedAt = createTimestamp();

    return {
      sessionId: turn.sessionId,
      turnId: turn.id,
      outcome: "completed",
      summary: execution.summary ?? plan.summary,
      filesChanged,
      validations,
      risks,
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

  private async tryExecuteReplaceAndVerifyTask(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
  ): Promise<{
    summary?: string;
    changedFile?: string;
    validation?: ValidationResult;
  }> {
    const parsed = parseReplaceAndVerifyTask(turn.input.content);

    if (!parsed) {
      return {};
    }

    const inspectStep = await this.startStep(turn, "context", context);
    const searchResult = await this.executeTool(
      turn,
      inspectStep,
      context,
      "search_text",
      {
        query: parsed.searchText,
      },
    );

    const matches = (searchResult.output as { matches?: SearchMatch[] } | undefined)?.matches ?? [];
    const targetMatch = matches[0];

    if (!targetMatch) {
      throw new Error(`Could not find text to replace: ${parsed.searchText}`);
    }

    await this.executeTool(
      turn,
      inspectStep,
      context,
      "read_file",
      {
        path: targetMatch.path,
      },
    );

    this.completeStep(turn, inspectStep.id);

    const editStep = await this.startStep(turn, "tool_use", context);
    await this.executeTool(
      turn,
      editStep,
      context,
      "apply_patch",
      {
        path: targetMatch.path,
        searchText: parsed.searchText,
        replaceText: parsed.replaceText,
      },
    );
    this.completeStep(turn, editStep.id);

    if (!parsed.verifyCommand) {
      return {
        summary: `Updated ${targetMatch.path}`,
        changedFile: targetMatch.path,
      };
    }

    const verifyStep = await this.startStep(turn, "verification", context);

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: verifyStep.id,
      type: "verify.started",
      timestamp: createTimestamp(),
      payload: {
        command: parsed.verifyCommand,
      },
    });

    const verifyResult = await this.executeTool(
      turn,
      verifyStep,
      context,
      "run_command",
      {
        command: parsed.verifyCommand,
      },
    );

    const commandOutput = verifyResult.output as
      | {
          exitCode?: number;
          stdout?: string;
          stderr?: string;
        }
      | undefined;
    const validation: ValidationResult = {
      name: parsed.verifyCommand,
      status: commandOutput?.exitCode === 0 ? "passed" : "failed",
      details: commandOutput
        ? String(commandOutput.stdout ?? "").trim() || String(commandOutput.stderr ?? "").trim()
        : undefined,
    };

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: verifyStep.id,
      type: "verify.finished",
      timestamp: createTimestamp(),
      payload: {
        validations: [validation],
      },
    });

    this.completeStep(turn, verifyStep.id);

    return {
      summary: `Updated ${targetMatch.path} and ran verification`,
      changedFile: targetMatch.path,
      validation,
    };
  }

  private async executeTool(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    toolName: string,
    input: Record<string, unknown>,
  ) {
    const request: ToolCallRequest = {
      id: createRuntimeId("call"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: step.id,
      toolName,
      input,
      requestedAt: createTimestamp(),
    };

    step.toolCallIds.push(request.id);

    const outcome = await context.toolExecutor.execute(request, {
      cwd: context.cwd,
      eventSink: context.eventSink,
      policyEngine: context.policyEngine,
      approvalResolver: context.approvalResolver,
    });

    if (outcome.result.status === "error" || outcome.result.status === "denied") {
      throw new Error(outcome.result.error?.message ?? `Tool failed: ${toolName}`);
    }

    return outcome.result;
  }

  private async startStep(turn: TurnRuntimeState, kind: StepKind, context: AgentExecutionContext): Promise<StepRuntimeState> {
    const step = await this.runStep(
      {
        id: createRuntimeId("step"),
        sessionId: turn.sessionId,
        turnId: turn.id,
        index: turn.steps.length,
        kind,
        status: "pending",
        startedAt: createTimestamp(),
        toolCallIds: [],
      },
      context,
    );

    turn.steps.push(step);
    return step;
  }

  private completeStep(turn: TurnRuntimeState, stepId: string): void {
    const step = turn.steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      return;
    }

    step.status = "completed";
    step.endedAt = createTimestamp();
  }
}

function parseReplaceAndVerifyTask(task: string): { searchText: string; replaceText: string; verifyCommand?: string } | null {
  const replaceMatch = task.match(/replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i);

  if (!replaceMatch) {
    return null;
  }

  const verifyMatch = task.match(/run\s+"([^"]+)"/i);

  return {
    searchText: replaceMatch[1] ?? "",
    replaceText: replaceMatch[2] ?? "",
    verifyCommand: verifyMatch?.[1],
  };
}
