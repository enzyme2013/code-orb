import type {
  ApprovalRequest,
  ApprovalResponse,
  PermissionDecision,
  PolicyContext,
  ToolCallRequest,
} from "@code-orb/schemas";

export interface PolicyEngine {
  evaluate(request: ToolCallRequest, context: PolicyContext): Promise<PermissionDecision>;
}

export interface ApprovalResolver {
  resolve(request: ApprovalRequest): Promise<ApprovalResponse>;
}
