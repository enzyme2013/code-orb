import type { SessionId, StepId, Timestamp, ToolCallId, TurnId } from "./ids.js";

export type ToolName = string;
export type ToolKind = "context" | "editing" | "execution" | "git" | "session";
export type ToolMutability = "read_only" | "mutating";
export type ToolApprovalRequirement = "auto" | "confirm" | "policy";
export type ToolExecutionStatus = "success" | "denied" | "error" | "cancelled";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  kind: ToolKind;
  mutability: ToolMutability;
  approvalRequirement: ToolApprovalRequirement;
  timeoutMs?: number;
  supportsInterrupt?: boolean;
}

export interface ToolCallRequest {
  id: ToolCallId;
  sessionId: SessionId;
  turnId: TurnId;
  stepId?: StepId;
  toolName: ToolName;
  input: Record<string, unknown>;
  requestedAt: Timestamp;
}

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ToolExecutionMetadata {
  startedAt: Timestamp;
  finishedAt?: Timestamp;
  durationMs?: number;
  backend?: string;
  cwd?: string;
  truncated?: boolean;
  exitCode?: number;
}

export interface ToolExecutionResult {
  callId: ToolCallId;
  status: ToolExecutionStatus;
  output?: unknown;
  metadata: ToolExecutionMetadata;
  error?: ToolExecutionError;
}
