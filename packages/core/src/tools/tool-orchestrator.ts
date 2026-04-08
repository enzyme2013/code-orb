import type { ToolCallRequest, ToolCanonicalResult, ToolDefinition } from "@code-orb/schemas";

import type { ToolExecutionContext, ToolExecutionDisposition, ToolExecutor } from "./tool-executor.js";

export interface ToolOrchestrationContext extends ToolExecutionContext {}

export interface OrchestratedToolResult {
  definition?: ToolDefinition;
  disposition: ToolExecutionDisposition;
  canonical: ToolCanonicalResult;
}

export interface ToolOrchestrator {
  listTools(): ToolDefinition[];
  execute(request: ToolCallRequest, context: ToolOrchestrationContext): Promise<OrchestratedToolResult>;
  executor(): ToolExecutor;
}
