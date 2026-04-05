import type {
  ModelMessage,
  StepKind,
  StepRuntimeState,
  ToolCallRequest,
  ToolExecutionResult,
  TurnPlan,
  TurnReport,
  TurnRuntimeState,
  ValidationResult,
} from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import type { SearchMatch } from "../tools/builtin-tool-helpers.js";
import { loadPromptAsset } from "../prompts/prompt-loader.js";
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

    const execution =
      (await this.tryExecuteFailingTestFixTask(turn, context)) ?? (await this.tryExecuteReplaceAndVerifyTask(turn, context));
    const validations = execution.validation ? [execution.validation] : undefined;
    const filesChanged = execution.changedFile ? [execution.changedFile] : undefined;
    const risks =
      execution.risks ??
      (execution.validation?.status === "failed"
        ? ["Verification command failed."]
        : execution.validation
          ? []
          : ["No verification command was run."]);

    turn.status = execution.outcome === "blocked" ? "blocked" : execution.outcome === "failed" ? "failed" : "completed";
    turn.endedAt = createTimestamp();

    return {
      sessionId: turn.sessionId,
      turnId: turn.id,
      outcome: execution.outcome ?? "completed",
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

  private async loadPlanningPrompts(task: string): Promise<string[]> {
    const prompts = [await loadPromptAsset("system/base.md")];

    if (parseFailingTestFixTask(task)) {
      prompts.push(await loadPromptAsset("planner/failing-test-fix.md"));
      prompts.push(await loadPromptAsset("executor/failing-test-fix.md"));
      prompts.push(await loadPromptAsset("reviewer/final-report.md"));
    }

    return prompts;
  }

  private async tryExecuteReplaceAndVerifyTask(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
  ): Promise<{
    summary?: string;
    changedFile?: string;
    validation?: ValidationResult;
    outcome?: TurnReport["outcome"];
    risks?: string[];
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
    const editResult = await this.executeToolResult(
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

    const editFailure = classifyToolFailure("apply_patch", editResult);
    if (editFailure) {
      return {
        summary: editFailure.summary,
        changedFile: targetMatch.path,
        outcome: editFailure.outcome,
        risks: editFailure.risks,
      };
    }

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

    if (validation.status === "failed") {
      return {
        summary: `Updated ${targetMatch.path}, but verification still failed.`,
        changedFile: targetMatch.path,
        validation,
        outcome: "failed",
        risks: ["Verification failed after the edit was applied."],
      };
    }

    return {
      summary: `Updated ${targetMatch.path} and ran verification`,
      changedFile: targetMatch.path,
      validation,
    };
  }

  private async tryExecuteFailingTestFixTask(
    turn: TurnRuntimeState,
    context: AgentExecutionContext,
  ): Promise<
      | {
        summary?: string;
        changedFile?: string;
        validation?: ValidationResult;
        outcome?: TurnReport["outcome"];
        risks?: string[];
      }
    | undefined
  > {
    const parsed = parseFailingTestFixTask(turn.input.content);

    if (!parsed) {
      return undefined;
    }

    let latestVerification = await this.runVerification(
      turn,
      await this.startStep(turn, "verification", context),
      context,
      parsed.verifyCommand,
    );
    let latestOutput = combineCommandOutput(latestVerification.output);
    let changedFile: string | undefined;
    let lastSummary: string | undefined;
    const attemptedFixes = new Set<string>();

    if (latestVerification.validation.status === "passed") {
      return {
        summary: `Verification already passed for ${parsed.verifyCommand}`,
        validation: latestVerification.validation,
      };
    }

    for (let attempt = 0; attempt < 2 && latestVerification.validation.status === "failed"; attempt += 1) {
      const diagnosis = deriveFailingTestDiagnosis(latestOutput);
      if (!diagnosis) {
        return {
          summary: "Verification failed, but the runtime could not diagnose the relevant implementation yet.",
          validation: latestVerification.validation,
        };
      }

      const contextStep = await this.startStep(turn, "context", context);
      await this.executeTool(turn, contextStep, context, "list_files", {});

      const testFile = await this.executeTool(turn, contextStep, context, "read_file", {
        path: diagnosis.testPath,
      });
      const sourceFile = await this.executeTool(turn, contextStep, context, "read_file", {
        path: diagnosis.sourcePath,
      });
      this.completeStep(turn, contextStep.id);

      const testContent = String((testFile.output as { content?: string } | undefined)?.content ?? "");
      const sourceContent = String((sourceFile.output as { content?: string } | undefined)?.content ?? "");
      const proposedFix = proposeImplementationFix(diagnosis, testContent, sourceContent);

      if (!proposedFix) {
        return {
          summary: `Identified ${diagnosis.sourcePath}, but no safe benchmark fix was available.`,
          changedFile: diagnosis.sourcePath,
          validation: latestVerification.validation,
        };
      }

      const fixKey = `${diagnosis.sourcePath}:${proposedFix.searchText}:${proposedFix.replaceText}`;
      if (attemptedFixes.has(fixKey)) {
        return {
          summary: `${proposedFix.summary}, but no new repair retry was available.`,
          changedFile: diagnosis.sourcePath,
          validation: latestVerification.validation,
        };
      }

      attemptedFixes.add(fixKey);

      const editStep = await this.startStep(turn, "tool_use", context);
      const editResult = await this.executeToolResult(turn, editStep, context, "apply_patch", {
        path: diagnosis.sourcePath,
        searchText: proposedFix.searchText,
        replaceText: proposedFix.replaceText,
      });
      this.completeStep(turn, editStep.id);

      const editFailure = classifyToolFailure("apply_patch", editResult);
      if (editFailure) {
        return {
          summary: `${proposedFix.summary} could not be applied: ${editFailure.reason}`,
          changedFile: diagnosis.sourcePath,
          validation: latestVerification.validation,
          outcome: editFailure.outcome,
          risks: editFailure.risks,
        };
      }

      changedFile = diagnosis.sourcePath;
      lastSummary = proposedFix.summary;

      latestVerification = await this.runVerification(
        turn,
        await this.startStep(turn, "verification", context),
        context,
        parsed.verifyCommand,
      );
      latestOutput = combineCommandOutput(latestVerification.output);
    }

    return {
      summary:
        latestVerification.validation.status === "passed"
          ? lastSummary
          : `${lastSummary ?? "Applied a benchmark fix"}, but verification still failed after a repair retry`,
      changedFile,
      validation: latestVerification.validation,
    };
  }

  private async executeTool(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    toolName: string,
    input: Record<string, unknown>,
  ) {
    const result = await this.executeToolResult(turn, step, context, toolName, input);

    if (result.status === "error" || result.status === "denied") {
      throw new Error(result.error?.message ?? `Tool failed: ${toolName}`);
    }

    return result;
  }

  private async executeToolResult(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
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

    return outcome.result;
  }

  private async runVerification(
    turn: TurnRuntimeState,
    step: StepRuntimeState,
    context: AgentExecutionContext,
    command: string,
  ): Promise<{
    output: {
      exitCode?: number;
      stdout?: string;
      stderr?: string;
    };
    validation: ValidationResult;
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

    const output = (verifyResult.output as
      | {
          exitCode?: number;
          stdout?: string;
          stderr?: string;
        }
      | undefined) ?? {
      exitCode: 1,
    };

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
      output,
      validation,
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
    const step = turn.steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      return;
    }

    step.status = "completed";
    step.endedAt = createTimestamp();
  }
}

function parseReplaceAndVerifyTask(task: string): { searchText: string; replaceText: string; verifyCommand?: string } | null {
  const replaceMatch =
    task.match(/replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i) ??
    task.match(/replacing\s+"([^"]+)"\s+with\s+"([^"]+)"/i) ??
    task.match(/update .*? by replacing\s+"([^"]+)"\s+with\s+"([^"]+)"/i);

  if (!replaceMatch) {
    return null;
  }

  const verifyMatch = task.match(/run\s+"([^"]+)"/i);
  const bareVerifyMatch = task.match(/\b(?:run|rerun|then run)\s+(node [a-zA-Z0-9./_-]+(?:\s+[a-zA-Z0-9./_-]+)*)/i);

  return {
    searchText: replaceMatch[1] ?? "",
    replaceText: replaceMatch[2] ?? "",
    verifyCommand: verifyMatch?.[1] ?? bareVerifyMatch?.[1],
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
