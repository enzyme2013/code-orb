import type {
  ApprovalResponse,
  PermissionDecision,
  PolicyContext,
  ToolCallRequest,
  ToolDefinition,
  ToolExecutionResult,
} from "@code-orb/schemas";

import type { EventSink } from "../events/event-sink.js";
import type { ApprovalResolver, PolicyEngine } from "../policy/policy-engine.js";

export interface ToolExecutionContext {
  cwd: string;
  eventSink: EventSink;
  policyEngine: PolicyEngine;
  approvalResolver: ApprovalResolver;
}

export interface ToolExecutionOutcome {
  decision: PermissionDecision;
  approvalResponse?: ApprovalResponse;
  result: ToolExecutionResult;
}

export type ToolExecutionDisposition =
  | "success"
  | "denied"
  | "cancelled"
  | "invalid_input"
  | "unknown_tool"
  | "error";

export interface NormalizedToolExecutionResult {
  disposition: ToolExecutionDisposition;
  result: ToolExecutionResult;
}

export interface ToolExecutor {
  listTools(): ToolDefinition[];
  execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolExecutionOutcome>;
  buildPolicyContext(request: ToolCallRequest, context: ToolExecutionContext): PolicyContext;
}

export function normalizeToolExecutionResult(result: ToolExecutionResult): NormalizedToolExecutionResult {
  if (result.status === "success") {
    return {
      disposition: "success",
      result,
    };
  }

  if (result.status === "denied") {
    return {
      disposition: "denied",
      result,
    };
  }

  if (result.status === "cancelled") {
    return {
      disposition: "cancelled",
      result,
    };
  }

  if (result.error?.code === "invalid_tool_input") {
    return {
      disposition: "invalid_input",
      result,
    };
  }

  if (result.error?.code === "unknown_tool") {
    return {
      disposition: "unknown_tool",
      result,
    };
  }

  return {
    disposition: "error",
    result,
  };
}
