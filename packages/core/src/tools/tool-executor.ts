import type {
  ApprovalResponse,
  PermissionDecision,
  PolicyContext,
  ToolCallRequest,
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

export interface ToolExecutor {
  execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolExecutionOutcome>;
  buildPolicyContext(request: ToolCallRequest, context: ToolExecutionContext): PolicyContext;
}
