import type { ApprovalRequestId, SessionId, StepId, Timestamp, ToolCallId, TurnId } from "./ids.js";

export type PermissionDecisionType = "allow" | "confirm" | "deny";
export type ApprovalResponseDecision = "approved" | "rejected";
export type ApprovalScope = "once" | "session" | "rule";

export interface PolicyContext {
  sessionId: SessionId;
  turnId: TurnId;
  stepId?: StepId;
  cwd: string;
  repoRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRequest {
  id: ApprovalRequestId;
  sessionId: SessionId;
  turnId: TurnId;
  stepId?: StepId;
  toolCallId: ToolCallId;
  summary: string;
  scope: ApprovalScope;
  details?: Record<string, unknown>;
}

export interface PermissionDecision {
  type: PermissionDecisionType;
  reason: string;
  approvalRequest?: ApprovalRequest;
  policyTrace?: string[];
}

export interface ApprovalResponse {
  requestId: ApprovalRequestId;
  decision: ApprovalResponseDecision;
  scope: ApprovalScope;
  respondedAt: Timestamp;
  rulePattern?: string[];
}
