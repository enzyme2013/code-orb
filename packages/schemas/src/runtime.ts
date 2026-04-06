import type { SessionId, StepId, Timestamp, ToolCallId, TurnId } from "./ids.js";
import type { SessionOutcome, TurnReport, ValidationResult } from "./report.js";
import type { GitWorkingTreeSnapshot } from "./session-artifact.js";

export type SessionStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
export type TurnStatus = "pending" | "running" | "completed" | "failed" | "blocked";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "blocked";
export type StepKind = "context" | "planning" | "tool_use" | "verification" | "reporting";
export type PlanItemStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface FollowUpContext {
  priorSessionId: SessionId;
  priorTask: string;
  priorOutcome: SessionOutcome;
  priorSummary: string;
  priorChangedFiles: string[];
  priorValidations: ValidationResult[];
  priorRisks: string[];
}

export interface SessionMetadata {
  followUpSessionId?: SessionId;
  followUpContext?: FollowUpContext;
  [key: string]: unknown;
}

export interface SessionInput {
  cwd: string;
  task: string;
  interactive?: boolean;
  metadata?: SessionMetadata;
}

export interface TurnInput {
  content: string;
  source: "user" | "system";
}

export interface PlanItem {
  id: string;
  content: string;
  status: PlanItemStatus;
}

export interface TurnPlan {
  summary: string;
  items: PlanItem[];
}

export interface StepRuntimeState {
  id: StepId;
  sessionId: SessionId;
  turnId: TurnId;
  index: number;
  kind: StepKind;
  status: StepStatus;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  toolCallIds: ToolCallId[];
  notes?: string[];
}

export interface TurnRuntimeState {
  id: TurnId;
  sessionId: SessionId;
  index: number;
  status: TurnStatus;
  input: TurnInput;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  plan?: TurnPlan;
  steps: StepRuntimeState[];
  summary?: string;
  report?: TurnReport;
}

export interface SessionRuntimeState {
  id: SessionId;
  cwd: string;
  task: string;
  status: SessionStatus;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  turns: TurnRuntimeState[];
  interactive?: boolean;
  metadata?: SessionMetadata;
  gitSnapshotBefore?: GitWorkingTreeSnapshot;
}
