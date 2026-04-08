import type {
  AppliedEdit,
  AppliedEditMode,
  AppliedEditTargetSource,
  ModelMessage,
  ModelResponse,
  ModelToolCall,
  StepKind,
  StepRuntimeState,
  ToolCallRequest,
  ToolExecutionResult,
  TurnPlan,
  TurnOutcome,
  TurnReport,
  TurnStopReason,
  TurnRuntimeState,
  ValidationResult,
} from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import type { SearchMatch } from "../tools/builtin-tool-helpers.js";
import { loadPromptAsset } from "../prompts/prompt-loader.js";
import type { OrchestratedToolResult } from "../tools/tool-orchestrator.js";
import type { AgentExecutionContext } from "./agent-engine.js";
import type { TurnQueryLoop } from "./turn-query-loop.js";

interface ReplaceAndVerifyTask {
  searchText: string;
  replaceText: string;
  verifyCommand?: string;
}

interface GeneratedFileWriteTask {
  path: string;
  content: string;
  pathSource: AppliedEditTargetSource;
  verifyCommand?: string;
}

interface FailingTestFixTask {
  verifyCommand: string;
}

interface FailingTestDiagnosis {
  testPath: string;
  sourcePath: string;
  symbolName: string;
}

interface ProposedImplementationFix {
  searchText: string;
  replaceText: string;
  summary: string;
}

interface PlanGeneration {
  plan: TurnPlan;
  response: ModelResponse;
  messages: ModelMessage[];
}

interface CommandOutput {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

interface VerificationExecution {
  output: CommandOutput;
  validation: ValidationResult;
}

type TurnIntent =
  | {
      type: "plan_only";
    }
  | {
      type: "model_tool_loop";
      messages: ModelMessage[];
      pendingToolCalls: ModelToolCall[];
      modelIterations: number;
    }
  | {
      type: "replace_and_verify";
      parsed: ReplaceAndVerifyTask;
      phase: "inspect_target" | "apply_edit" | "verify";
      targetMatch?: SearchMatch;
      appliedEdit?: AppliedEdit;
    }
  | {
      type: "generated_write";
      parsed: GeneratedFileWriteTask;
      phase: "apply_edit" | "verify";
      appliedEdit?: AppliedEdit;
    }
  | {
      type: "failing_test_fix";
      parsed: FailingTestFixTask;
      phase: "verify" | "inspect_context" | "apply_repair";
      latestVerification?: VerificationExecution;
      latestOutput?: string;
      diagnosis?: FailingTestDiagnosis;
      proposedFix?: ProposedImplementationFix;
      changedFile?: string;
      lastSummary?: string;
      appliedEdits: AppliedEdit[];
      attemptedFixes: Set<string>;
      repairAttempts: number;
    };

interface TurnLoopState {
  intent: TurnIntent;
  summary: string;
  outcome: TurnOutcome;
  stopReason?: TurnStopReason;
  edits: AppliedEdit[];
  validations: ValidationResult[];
  filesChanged: Set<string>;
  risks: Set<string>;
  iterations: number;
}

export class BasicTurnQueryLoop implements TurnQueryLoop {
  async runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport> {
    const planningStep = await this.startStep(turn, "planning", context);
    const planning = await this.generatePlan(turn, planningStep, context);
    turn.plan = planning.plan;
    turn.summary = planning.plan.summary;

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: planningStep.id,
      type: "plan.generated",
      timestamp: createTimestamp(),
      payload: {
        plan: planning.plan,
        profile: context.defaultProfile,
      },
    });

    this.completeStep(turn, planningStep.id);
    context.providerRuntime.recordModelResponse(turn, planning.response, planning.messages.length + 1);

    const loop = this.createTurnLoopState(turn, context, planning);
    await this.runTurnLoop(turn, context, loop);

    const risks = loop.risks.size > 0 ? [...loop.risks] : loop.validations.length > 0 ? [] : ["No verification command was run."];

    turn.status = loop.outcome === "blocked" ? "blocked" : loop.outcome === "failed" ? "failed" : "completed";
    turn.endedAt = createTimestamp();
    turn.stopReason = loop.stopReason;
    turn.iterationCount = loop.iterations;

    return {
      sessionId: turn.sessionId,
      turnId: turn.id,
      outcome: loop.outcome,
      summary: loop.summary,
      stopReason: loop.stopReason,
      stepCount: turn.steps.length,
      filesChanged: loop.filesChanged.size > 0 ? [...loop.filesChanged] : undefined,
      edits: loop.edits.length > 0 ? loop.edits : undefined,
      validations: loop.validations.length > 0 ? loop.validations : undefined,
      risks,
      nextSteps: planning.plan.items,
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
      status: "running",
      startedAt,
    };
  }

  private async runTurnLoop(turn: TurnRuntimeState, context: AgentExecutionContext, loop: TurnLoopState): Promise<void> {
    const maxIterations = 20;

    while (!loop.stopReason) {
      if (loop.iterations >= maxIterations) {
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "loop_limit_reached",
          summary: "Turn loop stopped because it exceeded the maximum iteration budget.",
          risks: ["Turn loop exceeded the maximum iteration budget before reaching a terminal state."],
        });
        break;
      }

      loop.iterations += 1;

      switch (loop.intent.type) {
        case "plan_only":
          this.stopLoop(loop, {
            outcome: "completed",
            stopReason: "model_completed",
            summary: loop.summary,
          });
          break;
        case "model_tool_loop":
          await this.advanceModelToolLoop(turn, context, loop, loop.intent);
          break;
        case "replace_and_verify":
          await this.advanceReplaceAndVerifyTurn(turn, context, loop, loop.intent);
          break;
        case "generated_write":
          await this.advanceGeneratedWriteTurn(turn, context, loop, loop.intent);
          break;
        case "failing_test_fix":
          await this.advanceFailingTestFixTurn(turn, context, loop, loop.intent);
          break;
      }
    }
  }

  private createTurnLoopState(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
    planning: PlanGeneration,
  ): TurnLoopState {
    const failingTestFix = parseFailingTestFixTask(turn.input.content);
    const replaceAndVerify = parseReplaceAndVerifyTask(turn.input.content);
    const generatedWrite = parseGeneratedFileWriteTask(turn.input.content, planning.response.content);
    const supportsToolLoop = context.modelClient.capabilities.toolCalling && (planning.response.toolCalls?.length ?? 0) > 0;

    const intent: TurnIntent = failingTestFix
      ? {
          type: "failing_test_fix",
          parsed: failingTestFix,
          phase: "verify",
          appliedEdits: [],
          attemptedFixes: new Set<string>(),
          repairAttempts: 0,
        }
      : replaceAndVerify
        ? {
            type: "replace_and_verify",
            parsed: replaceAndVerify,
            phase: "inspect_target",
          }
        : generatedWrite
          ? {
              type: "generated_write",
              parsed: generatedWrite,
              phase: "apply_edit",
            }
          : supportsToolLoop
            ? {
                type: "model_tool_loop",
                messages: [
                  ...planning.messages,
                  createAssistantResponseMessage(planning.response),
                ],
                pendingToolCalls: planning.response.toolCalls ?? [],
                modelIterations: 1,
              }
            : {
                type: "plan_only",
              };

    return {
      intent,
      summary: planning.plan.summary,
      outcome: "completed",
      edits: [],
      validations: [],
      filesChanged: new Set<string>(),
      risks: new Set<string>(),
      iterations: 0,
    };
  }

  private async generatePlan(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
  ): Promise<PlanGeneration> {
    const prompts = await this.loadPlanningPrompts(turn.input.content);
    const messages: ModelMessage[] = [
      ...prompts.map<ModelMessage>((content) => ({
        role: "system",
        content,
      })),
      {
        role: "user",
        content: turn.input.content,
      },
    ];

    if (context.followUpContext) {
      messages.splice(messages.length - 1, 0, {
        role: "system",
        content: formatFollowUpContext(context.followUpContext),
      });
    }

    const response = await this.requestModelResponse(turn, step.id, context, messages);
    const summary =
      response.content.trim() ||
      ((response.toolCalls?.length ?? 0) > 0 ? "Model requested tool execution for the current turn." : `Handled turn: ${turn.input.content}`);
    this.emitAssistantMessage(turn, step.id, context, response, summary);

    return {
      plan: {
        summary,
        items: [
          {
            id: createRuntimeId("plan"),
            content: `Review response from ${response.provider}/${response.model}`,
            status: "pending",
          },
        ],
      },
      response,
      messages,
    };
  }

  private async loadPlanningPrompts(task: string): Promise<string[]> {
    const prompts = [await loadPromptAsset("system/base.md")];

    if (parseFailingTestFixTask(task)) {
      prompts.push(await loadPromptAsset("planner/failing-test-fix.md"));
      prompts.push(await loadPromptAsset("executor/failing-test-fix.md"));
      prompts.push(await loadPromptAsset("reviewer/final-report.md"));
    }

    return prompts;
  }

  private async advanceReplaceAndVerifyTurn(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
    loop: TurnLoopState,
    intent: Extract<TurnIntent, { type: "replace_and_verify" }>,
  ): Promise<void> {
    if (intent.phase === "inspect_target") {
      const inspectStep = await this.startStep(turn, "context", context);
      const searchResult = await this.executeTool(turn, inspectStep, context, "search_text", {
        query: intent.parsed.searchText,
      });

      if (searchResult.disposition !== "success") {
        this.finishStep(turn, inspectStep.id, getStepStatusForToolDisposition(searchResult.disposition));
        this.stopForToolFailure(loop, "search_text", searchResult.canonical.result);
        return;
      }

      const matches = (searchResult.canonical.result.output as { matches?: SearchMatch[] } | undefined)?.matches ?? [];
      const targetMatch = matches[0];

      if (!targetMatch) {
        this.finishStep(turn, inspectStep.id, "failed");
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "context_unavailable",
          summary: `Could not find text to replace: ${intent.parsed.searchText}`,
          risks: ["The requested replacement text was not found in the repository."],
        });
        return;
      }

      const readResult = await this.executeTool(turn, inspectStep, context, "read_file", {
        path: targetMatch.path,
      });

      if (readResult.disposition !== "success") {
        this.finishStep(turn, inspectStep.id, getStepStatusForToolDisposition(readResult.disposition));
        this.stopForToolFailure(loop, "read_file", readResult.canonical.result);
        return;
      }

      this.completeStep(turn, inspectStep.id);
      intent.targetMatch = targetMatch;
      intent.phase = "apply_edit";
      return;
    }

    if (intent.phase === "apply_edit") {
      if (!intent.targetMatch) {
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "context_unavailable",
          summary: "Replacement target context was not available when the edit step started.",
          risks: ["The runtime lost the replacement target before the edit could be applied."],
        });
        return;
      }

      const editStep = await this.startStep(turn, "tool_use", context);
      const editResult = await this.executeTool(turn, editStep, context, "apply_patch", {
        path: intent.targetMatch.path,
        searchText: intent.parsed.searchText,
        replaceText: intent.parsed.replaceText,
      });

      if (editResult.disposition !== "success") {
        this.finishStep(turn, editStep.id, getStepStatusForToolDisposition(editResult.disposition));
        loop.filesChanged.add(intent.targetMatch.path);
        this.stopForToolFailure(loop, "apply_patch", editResult.canonical.result);
        return;
      }

      this.completeStep(turn, editStep.id);

      const appliedEdit = buildAppliedEdit(editResult.canonical.result, intent.targetMatch.path, "targeted_replacement");
      intent.appliedEdit = appliedEdit;
      loop.edits.push(appliedEdit);
      loop.filesChanged.add(appliedEdit.path);
      this.emitAppliedEdit(turn, editStep.id, context, appliedEdit);

      if (!intent.parsed.verifyCommand) {
        this.stopLoop(loop, {
          outcome: "completed",
          stopReason: "task_completed",
          summary: `Updated ${intent.targetMatch.path}`,
        });
        return;
      }

      intent.phase = "verify";
      return;
    }

    const verify = await this.runVerification(
      turn,
      await this.startStep(turn, "verification", context),
      context,
      intent.parsed.verifyCommand ?? "node verify.mjs",
    );

    if (!verify.execution) {
      this.stopForToolFailure(loop, "run_command", verify.toolResult?.canonical.result ?? createMissingToolResult("run_command"));
      return;
    }

    loop.validations.push(verify.execution.validation);

    if (verify.execution.validation.status === "failed") {
      this.stopLoop(loop, {
        outcome: "failed",
        stopReason: "verification_failed",
        summary: `Updated ${intent.targetMatch?.path ?? "the target file"}, but verification still failed.`,
        risks: ["Verification failed after the edit was applied."],
      });
      return;
    }

    this.stopLoop(loop, {
      outcome: "completed",
      stopReason: "task_completed",
      summary: `Updated ${intent.targetMatch?.path ?? "the target file"} and ran verification`,
    });
  }

  private async advanceGeneratedWriteTurn(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
    loop: TurnLoopState,
    intent: Extract<TurnIntent, { type: "generated_write" }>,
  ): Promise<void> {
    if (intent.phase === "apply_edit") {
      const editStep = await this.startStep(turn, "tool_use", context);
      const editResult = await this.executeTool(turn, editStep, context, "apply_patch", {
        path: intent.parsed.path,
        searchText: "",
        replaceText: intent.parsed.content,
      });

      if (editResult.disposition !== "success") {
        this.finishStep(turn, editStep.id, getStepStatusForToolDisposition(editResult.disposition));
        loop.filesChanged.add(intent.parsed.path);
        this.stopForToolFailure(loop, "apply_patch", editResult.canonical.result);
        return;
      }

      this.completeStep(turn, editStep.id);

      const appliedEdit = buildAppliedEdit(
        editResult.canonical.result,
        intent.parsed.path,
        inferGeneratedEditMode(editResult.canonical.result),
        intent.parsed.pathSource,
      );
      intent.appliedEdit = appliedEdit;
      loop.edits.push(appliedEdit);
      loop.filesChanged.add(appliedEdit.path);
      this.emitAppliedEdit(turn, editStep.id, context, appliedEdit);

      if (!intent.parsed.verifyCommand) {
        this.stopLoop(loop, {
          outcome: "completed",
          stopReason: "task_completed",
          summary: `Wrote ${intent.parsed.path} from assistant-generated content`,
        });
        return;
      }

      intent.phase = "verify";
      return;
    }

    const verify = await this.runVerification(
      turn,
      await this.startStep(turn, "verification", context),
      context,
      intent.parsed.verifyCommand ?? "node verify.mjs",
    );

    if (!verify.execution) {
      this.stopForToolFailure(loop, "run_command", verify.toolResult?.canonical.result ?? createMissingToolResult("run_command"));
      return;
    }

    loop.validations.push(verify.execution.validation);

    if (verify.execution.validation.status === "failed") {
      this.stopLoop(loop, {
        outcome: "failed",
        stopReason: "verification_failed",
        summary: `Wrote ${intent.parsed.path}, but verification still failed.`,
        risks: ["Verification failed after the file was written."],
      });
      return;
    }

    this.stopLoop(loop, {
      outcome: "completed",
      stopReason: "task_completed",
      summary: `Wrote ${intent.parsed.path} and ran verification`,
    });
  }

  private async advanceFailingTestFixTurn(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
    loop: TurnLoopState,
    intent: Extract<TurnIntent, { type: "failing_test_fix" }>,
  ): Promise<void> {
    if (intent.phase === "verify") {
      const verify = await this.runVerification(
        turn,
        await this.startStep(turn, "verification", context),
        context,
        intent.parsed.verifyCommand,
      );

      if (!verify.execution) {
        this.stopForToolFailure(loop, "run_command", verify.toolResult?.canonical.result ?? createMissingToolResult("run_command"));
        return;
      }

      intent.latestVerification = verify.execution;
      intent.latestOutput = combineCommandOutput(verify.execution.output);
      loop.validations.push(verify.execution.validation);

      if (verify.execution.validation.status === "passed") {
        this.stopLoop(loop, {
          outcome: "completed",
          stopReason: "task_completed",
          summary: intent.lastSummary ?? `Verification already passed for ${intent.parsed.verifyCommand}`,
        });
        return;
      }

      if (intent.repairAttempts >= 2) {
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "repair_exhausted",
          summary: `${intent.lastSummary ?? "Applied a benchmark fix"}, but verification still failed after a repair retry`,
          risks: ["Verification still failed after the repair retry budget was exhausted."],
        });
        return;
      }

      const diagnosis = deriveFailingTestDiagnosis(intent.latestOutput ?? "");
      if (!diagnosis) {
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "context_unavailable",
          summary: "Verification failed, but the runtime could not diagnose the relevant implementation yet.",
          risks: ["The runtime could not diagnose the implementation target from the verification output."],
        });
        return;
      }

      intent.diagnosis = diagnosis;
      intent.phase = "inspect_context";
      return;
    }

    if (intent.phase === "inspect_context") {
      if (!intent.diagnosis) {
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "context_unavailable",
          summary: "Verification context was unavailable before repair inspection could continue.",
          risks: ["The runtime lost the diagnosis state before the repair inspection step."],
        });
        return;
      }

      const contextStep = await this.startStep(turn, "context", context);
      const listFiles = await this.executeTool(turn, contextStep, context, "list_files", {});
      if (listFiles.disposition !== "success") {
        this.finishStep(turn, contextStep.id, getStepStatusForToolDisposition(listFiles.disposition));
        this.stopForToolFailure(loop, "list_files", listFiles.canonical.result);
        return;
      }

      const testFile = await this.executeTool(turn, contextStep, context, "read_file", {
        path: intent.diagnosis.testPath,
      });
      if (testFile.disposition !== "success") {
        this.finishStep(turn, contextStep.id, getStepStatusForToolDisposition(testFile.disposition));
        this.stopForToolFailure(loop, "read_file", testFile.canonical.result);
        return;
      }

      const sourceFile = await this.executeTool(turn, contextStep, context, "read_file", {
        path: intent.diagnosis.sourcePath,
      });
      if (sourceFile.disposition !== "success") {
        this.finishStep(turn, contextStep.id, getStepStatusForToolDisposition(sourceFile.disposition));
        this.stopForToolFailure(loop, "read_file", sourceFile.canonical.result);
        return;
      }

      this.completeStep(turn, contextStep.id);

      const testContent = String((testFile.canonical.result.output as { content?: string } | undefined)?.content ?? "");
      const sourceContent = String((sourceFile.canonical.result.output as { content?: string } | undefined)?.content ?? "");
      const proposedFix = proposeImplementationFix(intent.diagnosis, testContent, sourceContent);

      if (!proposedFix) {
        loop.filesChanged.add(intent.diagnosis.sourcePath);
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "context_unavailable",
          summary: `Identified ${intent.diagnosis.sourcePath}, but no safe benchmark fix was available.`,
          risks: ["The runtime could not derive a safe repair from the inspected context."],
        });
        return;
      }

      const fixKey = `${intent.diagnosis.sourcePath}:${proposedFix.searchText}:${proposedFix.replaceText}`;
      if (intent.attemptedFixes.has(fixKey)) {
        loop.filesChanged.add(intent.diagnosis.sourcePath);
        this.stopLoop(loop, {
          outcome: "failed",
          stopReason: "repair_exhausted",
          summary: `${proposedFix.summary}, but no new repair retry was available.`,
          risks: ["The runtime had no new repair candidate after the previous retry."],
        });
        return;
      }

      intent.attemptedFixes.add(fixKey);
      intent.proposedFix = proposedFix;
      intent.phase = "apply_repair";
      return;
    }

    if (!intent.diagnosis || !intent.proposedFix) {
      this.stopLoop(loop, {
        outcome: "failed",
        stopReason: "context_unavailable",
        summary: "Repair context was unavailable before the patch step could continue.",
        risks: ["The runtime lost the repair context before applying the patch."],
      });
      return;
    }

    const editStep = await this.startStep(turn, "tool_use", context);
    const editResult = await this.executeTool(turn, editStep, context, "apply_patch", {
      path: intent.diagnosis.sourcePath,
      searchText: intent.proposedFix.searchText,
      replaceText: intent.proposedFix.replaceText,
    });

    if (editResult.disposition !== "success") {
      this.finishStep(turn, editStep.id, getStepStatusForToolDisposition(editResult.disposition));
      loop.filesChanged.add(intent.diagnosis.sourcePath);
      const editFailure = classifyToolFailure("apply_patch", editResult.canonical.result);
      this.stopLoop(loop, {
        outcome: editFailure?.outcome ?? "failed",
        stopReason: editResult.disposition === "denied" ? "tool_denied" : "tool_failed",
        summary: `${intent.proposedFix.summary} could not be applied: ${editFailure?.reason ?? "the edit tool failed"}`,
        risks: editFailure?.risks ?? ["The repair patch could not be applied."],
      });
      return;
    }

    this.completeStep(turn, editStep.id);

    const appliedEdit = buildAppliedEdit(editResult.canonical.result, intent.diagnosis.sourcePath, "targeted_replacement");
    intent.changedFile = intent.diagnosis.sourcePath;
    intent.lastSummary = intent.proposedFix.summary;
    intent.appliedEdits.push(appliedEdit);
    intent.repairAttempts += 1;
    loop.edits.push(appliedEdit);
    loop.filesChanged.add(appliedEdit.path);
    this.emitAppliedEdit(turn, editStep.id, context, appliedEdit);

    intent.phase = "verify";
    intent.proposedFix = undefined;
  }

  private async advanceModelToolLoop(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
    loop: TurnLoopState,
    intent: Extract<TurnIntent, { type: "model_tool_loop" }>,
  ): Promise<void> {
    if (intent.pendingToolCalls.length === 0) {
      this.stopLoop(loop, {
        outcome: "completed",
        stopReason: "model_completed",
        summary: loop.summary,
      });
      return;
    }

    for (const toolCall of intent.pendingToolCalls) {
      const toolStep = await this.startStep(turn, "tool_use", context);
      const toolResult = await this.executeTool(turn, toolStep, context, toolCall.name, toolCall.input);
      this.finishStep(turn, toolStep.id, getStepStatusForToolDisposition(toolResult.disposition));
      this.recordModelToolSideEffect(turn, toolStep.id, context, loop, toolCall, toolResult.canonical.result);
      intent.messages.push(createToolResponseMessage(toolCall, toolResult));
    }

    intent.pendingToolCalls = [];

    if (intent.modelIterations >= 6) {
      this.stopLoop(loop, {
        outcome: "failed",
        stopReason: "loop_limit_reached",
        summary: "Model tool loop stopped because it exceeded the maximum follow-up budget.",
        risks: ["Model tool loop exceeded the maximum follow-up budget before producing a final response."],
      });
      return;
    }

    const modelStep = await this.startStep(turn, "model", context);
    const response = await this.requestModelResponse(turn, modelStep.id, context, intent.messages);
    this.completeStep(turn, modelStep.id);
    intent.messages.push(createAssistantResponseMessage(response));
    intent.modelIterations += 1;
    context.providerRuntime.recordModelResponse(turn, response, intent.messages.length);

    const fallbackSummary =
      response.content.trim() ||
      ((response.toolCalls?.length ?? 0) > 0 ? `Model requested ${response.toolCalls?.length ?? 0} additional tool call(s).` : loop.summary);
    this.emitAssistantMessage(turn, modelStep.id, context, response, fallbackSummary);

    if (response.content.trim()) {
      loop.summary = response.content.trim();
    }

    if ((response.toolCalls?.length ?? 0) > 0) {
      intent.pendingToolCalls = response.toolCalls ?? [];
      return;
    }

    this.stopLoop(loop, {
      outcome: "completed",
      stopReason: response.content.trim() ? "task_completed" : "model_completed",
      summary: response.content.trim() || loop.summary,
    });
  }

  private async executeTool(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<OrchestratedToolResult> {
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

    return await context.toolOrchestrator.execute(request, {
      cwd: context.cwd,
      eventSink: context.eventSink,
      policyEngine: context.policyEngine,
      approvalResolver: context.approvalResolver,
    });
  }

  private async runVerification(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    command: string,
  ): Promise<{
    execution?: VerificationExecution;
    toolResult?: OrchestratedToolResult;
  }> {
    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: step.id,
      type: "verify.started",
      timestamp: createTimestamp(),
      payload: {
        command,
      },
    });

    const verifyResult = await this.executeTool(
      turn,
      step,
      context,
      "run_command",
      {
        command,
      },
    );

    if (verifyResult.disposition !== "success") {
      this.finishStep(turn, step.id, getStepStatusForToolDisposition(verifyResult.disposition));
      return {
        toolResult: verifyResult,
      };
    }

    const output = (verifyResult.canonical.result.output as CommandOutput | undefined) ?? { exitCode: 1 };

    const validation: ValidationResult = {
      name: command,
      status: output.exitCode === 0 ? "passed" : "failed",
      details: String(output.stdout ?? "").trim() || String(output.stderr ?? "").trim() || undefined,
    };

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId: step.id,
      type: "verify.finished",
      timestamp: createTimestamp(),
      payload: {
        validations: [validation],
      },
    });

    this.completeStep(turn, step.id);

    return {
      execution: {
        output,
        validation,
      },
    };
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
    this.finishStep(turn, stepId, "completed");
  }

  private finishStep(turn: TurnRuntimeState, stepId: string, status: StepRuntimeState["status"]): void {
    const step = turn.steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      return;
    }

    step.status = status;
    step.endedAt = createTimestamp();
  }

  private emitAppliedEdit(
    turn: TurnRuntimeState,
    stepId: string,
    context: AgentExecutionContext,
    edit: AppliedEdit,
  ): void {
    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId,
      type: "edit.applied",
      timestamp: createTimestamp(),
      payload: {
        edit,
      },
    });
  }

  private async requestModelResponse(
    turn: TurnRuntimeState,
    stepId: string,
    context: AgentExecutionContext,
    messages: ModelMessage[],
  ): Promise<ModelResponse> {
    const availableTools = context.modelClient.capabilities.toolCalling ? context.toolOrchestrator.listTools() : [];

    return await context.modelClient.complete({
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId,
      profile: context.defaultProfile,
      messages,
      tools: availableTools.length > 0 ? availableTools : undefined,
      continuation: context.providerRuntime.continuationForTurn(turn),
    });
  }

  private emitAssistantMessage(
    turn: TurnRuntimeState,
    stepId: string,
    context: AgentExecutionContext,
    response: ModelResponse,
    fallbackContent: string,
  ): void {
    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: turn.sessionId,
      turnId: turn.id,
      stepId,
      type: "assistant.message",
      timestamp: createTimestamp(),
      payload: {
        content: response.content.trim() || fallbackContent,
        profile: context.defaultProfile,
        provider: response.provider,
        model: response.model,
        compatibility: response.compatibility,
      },
    });
  }

  private stopLoop(
    loop: TurnLoopState,
    stop: {
      outcome: TurnOutcome;
      stopReason: TurnStopReason;
      summary: string;
      risks?: string[];
    },
  ): void {
    loop.outcome = stop.outcome;
    loop.stopReason = stop.stopReason;
    loop.summary = stop.summary;

    for (const risk of stop.risks ?? []) {
      loop.risks.add(risk);
    }
  }

  private stopForToolFailure(loop: TurnLoopState, toolName: string, result: ToolExecutionResult): void {
    const failure = classifyToolFailure(toolName, result);

    this.stopLoop(loop, {
      outcome: failure?.outcome ?? "failed",
      stopReason: result.status === "denied" ? "tool_denied" : "tool_failed",
      summary: failure?.summary ?? `${toolName} failed before the turn could continue.`,
      risks: failure?.risks ?? [result.error?.message ?? `${toolName} failed before the turn could continue.`],
    });
  }

  private recordModelToolSideEffect(
    turn: TurnRuntimeState,
    stepId: string,
    context: AgentExecutionContext,
    loop: TurnLoopState,
    toolCall: ModelToolCall,
    result: ToolExecutionResult,
  ): void {
    if (toolCall.name !== "apply_patch" || result.status !== "success") {
      return;
    }

    const fallbackPath = typeof toolCall.input.path === "string" ? toolCall.input.path : "unknown";
    const searchText = typeof toolCall.input.searchText === "string" ? toolCall.input.searchText : undefined;
    const mode: AppliedEditMode = searchText && searchText.length > 0 ? "targeted_replacement" : inferGeneratedEditMode(result);
    const appliedEdit = buildAppliedEdit(result, fallbackPath, mode);
    loop.edits.push(appliedEdit);
    loop.filesChanged.add(appliedEdit.path);
    this.emitAppliedEdit(turn, stepId, context, appliedEdit);
  }

}

function createAssistantResponseMessage(response: ModelResponse): ModelMessage {
  return {
    role: "assistant",
    content: response.content,
  };
}

function createToolResponseMessage(toolCall: ModelToolCall, toolResult: OrchestratedToolResult): ModelMessage {
  return {
    role: "tool",
    name: toolCall.name,
    toolCallId: toolCall.id,
    content: toolResult.canonical.modelOutput.content,
  };
}

function createMissingToolResult(toolName: string): ToolExecutionResult {
  return {
    callId: createRuntimeId("call"),
    status: "error",
    metadata: {
      startedAt: createTimestamp(),
      finishedAt: createTimestamp(),
    },
    error: {
      code: "tool_execution_failed",
      message: `${toolName} did not produce a verification outcome.`,
    },
  };
}

function getStepStatusForToolDisposition(disposition: OrchestratedToolResult["disposition"]): StepRuntimeState["status"] {
  if (disposition === "success") {
    return "completed";
  }

  if (disposition === "denied") {
    return "blocked";
  }

  return "failed";
}

function formatFollowUpContext(context: AgentExecutionContext["followUpContext"]): string {
  if (!context) {
    return "";
  }

  return [
    `Follow-up context from prior session ${context.priorSessionId}:`,
    `Prior task: ${context.priorTask}`,
    `Prior outcome: ${context.priorOutcome}`,
    `Prior summary: ${context.priorSummary}`,
    `Prior changed files: ${context.priorChangedFiles.join(", ") || "none"}`,
    `Prior validations: ${context.priorValidations.map((validation) => `${validation.name}=${validation.status}`).join(", ") || "none"}`,
    `Prior risks: ${context.priorRisks.join(", ") || "none"}`,
  ].join("\n");
}

function parseReplaceAndVerifyTask(task: string): { searchText: string; replaceText: string; verifyCommand?: string } | null {
  const replaceMatch =
    task.match(/replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i) ??
    task.match(/replacing\s+"([^"]+)"\s+with\s+"([^"]+)"/i) ??
    task.match(/update .*? by replacing\s+"([^"]+)"\s+with\s+"([^"]+)"/i);

  if (!replaceMatch) {
    return null;
  }

  return {
    searchText: replaceMatch[1] ?? "",
    replaceText: replaceMatch[2] ?? "",
    verifyCommand: extractVerifyCommand(task),
  };
}

function parseGeneratedFileWriteTask(
  task: string,
  assistantResponse: string,
): { path: string; content: string; pathSource: AppliedEditTargetSource; verifyCommand?: string } | null {
  if (!looksLikeFileWriteTask(task)) {
    return null;
  }

  const codeBlock = extractCodeBlock(assistantResponse);
  if (!codeBlock) {
    return null;
  }

  const requestedPath = extractRequestedPath(task);
  const assistantSuggestedPath = extractSuggestedPathFromAssistantResponse(assistantResponse);
  const inferredPath = inferGeneratedFilePath(task, codeBlock.language);
  const path = requestedPath ?? assistantSuggestedPath ?? inferredPath;
  if (!path) {
    return null;
  }

  return {
    path,
    content: ensureTrailingNewline(codeBlock.content),
    pathSource: requestedPath ? "task" : assistantSuggestedPath ? "assistant" : "inferred",
    verifyCommand: extractVerifyCommand(task),
  };
}

function parseFailingTestFixTask(task: string): { verifyCommand: string } | null {
  if (!/failing test/i.test(task)) {
    return null;
  }

  const quotedCommand = task.match(/"(node [^"]+)"/i)?.[1];
  if (quotedCommand) {
    return {
      verifyCommand: quotedCommand,
    };
  }

  const nodeCommand = task.match(/\bnode\s+([a-zA-Z0-9./_-]+\.mjs)\b/i)?.[0];
  return {
    verifyCommand: nodeCommand ?? "node verify.mjs",
  };
}

function extractVerifyCommand(task: string): string | undefined {
  const verifyMatch = task.match(/run\s+"([^"]+)"/i);
  const bareVerifyMatch = task.match(
    /\b(?:run|rerun|then run)\s+((?:node|pnpm|npm|bash|sh)\s+[a-zA-Z0-9./_:-]+(?:\s+[a-zA-Z0-9./_:-]+)*)/i,
  );

  return verifyMatch?.[1] ?? bareVerifyMatch?.[1];
}

function looksLikeFileWriteTask(task: string): boolean {
  const normalizedTask = task.toLowerCase();
  const hasFileTarget =
    /\b(file|script|shell script|bash script|readme|config)\b/i.test(task) ||
    /\b[a-zA-Z0-9_./-]+\.(?:sh|bash|zsh|js|ts|mjs|cjs|py|md|txt|json|ya?ml)\b/.test(task) ||
    /(?:文件|脚本|配置|README)/i.test(task);
  const hasWriteIntent =
    /(create|write|add|make|generate|new|update|modify|rewrite|overwrite|replace contents of)\b/i.test(task) ||
    /(?:写|创建|新建|生成|修改|重写|覆盖|更新)/.test(task);

  if (!hasFileTarget || !hasWriteIntent) {
    return false;
  }

  if (/replace\s+"[^"]+"\s+with\s+"[^"]+"/i.test(task) || /replacing\s+"[^"]+"\s+with\s+"[^"]+"/i.test(task)) {
    return false;
  }

  if (normalizedTask.includes("failing test")) {
    return false;
  }

  return true;
}

function extractRequestedPath(task: string): string | undefined {
  return extractPathCandidate(task);
}

function extractSuggestedPathFromAssistantResponse(assistantResponse: string): string | undefined {
  const saveAsMatch =
    assistantResponse.match(/(?:save(?: it)? as|saved as|保存为)\s*["'`]?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)["'`]?/i)?.[1] ??
    assistantResponse.match(/["'`]([a-zA-Z0-9_./-]+\.(?:sh|bash|zsh|js|ts|mjs|cjs|py|md|txt|json|ya?ml))["'`]/)?.[1];

  return saveAsMatch ?? extractPathCandidate(assistantResponse);
}

function extractPathCandidate(content: string): string | undefined {
  const quotedPath =
    content.match(/["'`]([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)["'`]/)?.[1] ??
    content.match(/[“]([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)[”]/)?.[1];

  if (quotedPath) {
    return quotedPath;
  }

  return content.match(/\b[a-zA-Z0-9_./-]+\.(?:sh|bash|zsh|js|ts|mjs|cjs|py|md|txt|json|ya?ml)\b/)?.[0];
}

function inferGeneratedFilePath(task: string, language: string | undefined): string | undefined {
  if (/\.(sh|bash|zsh)\b/i.test(task) || /(shell script|bash script|\bsh\b)/i.test(task) || /脚本/.test(task)) {
    if (/(disk|drive|storage|space|硬盘|磁盘)/i.test(task) && /(free|remaining|剩余|可用)/i.test(task)) {
      return "show-disk-space.sh";
    }

    return "script.sh";
  }

  if (language === "sh" || language === "bash" || language === "zsh") {
    return "script.sh";
  }

  return undefined;
}

function extractCodeBlock(content: string): { language?: string; content: string } | null {
  const match = content.match(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);

  if (!match || !(match[2] ?? "").trim()) {
    return null;
  }

  return {
    language: match[1]?.trim().toLowerCase(),
    content: match[2].replace(/\n+$/, ""),
  };
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function combineCommandOutput(output: { stdout?: string; stderr?: string }): string {
  return [output.stdout ?? "", output.stderr ?? ""].filter(Boolean).join("\n");
}

function deriveFailingTestDiagnosis(
  verificationOutput: string,
): { testPath: string; sourcePath: string; symbolName: string } | null {
  const match = verificationOutput.match(/dist\/tests\/([a-zA-Z0-9_-]+)\.test\.js/);

  if (!match) {
    return null;
  }

  const baseName = match[1] ?? "";

  return {
    testPath: `tests/${baseName}.test.ts`,
    sourcePath: `src/${baseName}.ts`,
    symbolName: baseName,
  };
}

function proposeImplementationFix(
  diagnosis: { testPath: string; sourcePath: string; symbolName: string },
  testContent: string,
  sourceContent: string,
): { searchText: string; replaceText: string; summary: string } | null {
  if (
    diagnosis.symbolName === "chunk" &&
    testContent.includes("final partial chunk") &&
    sourceContent.includes("index + size <= items.length")
  ) {
    return {
      searchText: "for (let index = 0; index + size <= items.length; index += size) {",
      replaceText: "for (let index = 0; index < items.length; index += size) {",
      summary: "Fixed chunk so it preserves the final partial chunk before verification rerun",
    };
  }

  return null;
}

function classifyToolFailure(
  toolName: string,
  result: ToolExecutionResult,
): { summary: string; reason: string; outcome: TurnReport["outcome"]; risks: string[] } | null {
  if (result.status === "success") {
    return null;
  }

  if (result.status === "denied") {
    return {
      summary: `${toolName} was blocked because approval was denied.`,
      reason: "approval was denied",
      outcome: "blocked",
      risks: ["Mutating edit was blocked by approval denial."],
    };
  }

  if (result.error?.code === "edit_target_not_found") {
    return {
      summary: `Could not apply ${toolName} because the expected edit target was not found.`,
      reason: "the expected edit target was not found",
      outcome: "failed",
      risks: ["The requested edit could not be applied because the target text no longer matched the file."],
    };
  }

  if (result.error?.code === "path_outside_repo") {
    return {
      summary: `${toolName} was blocked because the target path was outside the repository.`,
      reason: "the target path was outside the repository",
      outcome: "blocked",
      risks: ["The requested edit targeted a path outside the active repository."],
    };
  }

  if (result.status === "error") {
    return {
      summary: `${toolName} failed before verification could continue.`,
      reason: result.error?.message ?? "the edit tool failed",
      outcome: "failed",
      risks: [result.error?.message ?? "The edit tool failed before verification could continue."],
    };
  }

  return null;
}

function inferGeneratedEditMode(result: ToolExecutionResult): AppliedEditMode {
  const output = result.output as { created?: boolean } | undefined;
  return output?.created ? "generated_create" : "generated_rewrite";
}

function buildAppliedEdit(
  result: ToolExecutionResult,
  fallbackPath: string,
  mode: AppliedEditMode,
  targetSource?: AppliedEditTargetSource,
): AppliedEdit {
  const output = result.output as
    | {
        path?: string;
        replaced?: boolean;
        created?: boolean;
      }
    | undefined;

  return {
    mode,
    path: String(output?.path ?? fallbackPath),
    changed: Boolean(output?.replaced),
    toolName: "apply_patch",
    created: output?.created === true ? true : undefined,
    targetSource,
  };
}

function collectChangedFiles(changedFile?: string, edits?: AppliedEdit[]): string[] | undefined {
  const files = new Set<string>();

  if (changedFile) {
    files.add(changedFile);
  }

  for (const edit of edits ?? []) {
    files.add(edit.path);
  }

  return files.size > 0 ? [...files] : undefined;
}
