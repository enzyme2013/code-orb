import { createCanonicalToolResult } from "../engine/model-tool-result.js";
import { normalizeToolExecutionResult } from "./tool-executor.js";
import type { ToolExecutionContext, ToolExecutor } from "./tool-executor.js";
import type { OrchestratedToolResult, ToolOrchestrator, ToolOrchestrationContext } from "./tool-orchestrator.js";
import type { ToolCallRequest } from "@code-orb/schemas";

export class BasicToolOrchestrator implements ToolOrchestrator {
  constructor(private readonly toolExecutor: ToolExecutor) {}

  listTools() {
    return this.toolExecutor.listTools();
  }

  executor(): ToolExecutor {
    return this.toolExecutor;
  }

  async execute(request: ToolCallRequest, context: ToolOrchestrationContext): Promise<OrchestratedToolResult> {
    const definition = this.toolExecutor.listTools().find((tool) => tool.name === request.toolName);
    const outcome = await this.toolExecutor.execute(request, context as ToolExecutionContext);
    const normalized = normalizeToolExecutionResult(outcome.result);

    return {
      definition,
      disposition: normalized.disposition,
      canonical: createCanonicalToolResult(outcome.result),
    };
  }
}
