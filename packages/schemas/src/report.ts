import type { SessionId, Timestamp, TurnId } from "./ids.js";
import type { PlanItem } from "./runtime.js";
import type { GitWorkingTreeSnapshot } from "./session-artifact.js";

export type ValidationStatus = "passed" | "failed" | "skipped";
export type TurnOutcome = "completed" | "failed" | "blocked";
export type SessionOutcome = "completed" | "failed" | "cancelled";
export type MutatingActionStatus = "requested" | "approved" | "rejected" | "applied" | "completed" | "failed";
export type TurnStopReason =
  | "model_completed"
  | "task_completed"
  | "context_unavailable"
  | "tool_denied"
  | "tool_failed"
  | "verification_failed"
  | "repair_exhausted"
  | "loop_limit_reached";
export type AppliedEditMode = "generated_create" | "generated_rewrite" | "targeted_replacement";
export type AppliedEditTargetSource = "task" | "assistant" | "inferred";

export interface ProjectInstructionSource {
  path: string;
  source: "repository";
}

export interface MutatingActionReport {
  toolName: string;
  status: MutatingActionStatus;
  summary: string;
  path?: string;
  command?: string;
}

export interface ValidationResult {
  name: string;
  status: ValidationStatus;
  details?: string;
}

export interface AppliedEdit {
  mode: AppliedEditMode;
  path: string;
  changed: boolean;
  toolName: string;
  created?: boolean;
  targetSource?: AppliedEditTargetSource;
}

export interface TurnReport {
  sessionId: SessionId;
  turnId: TurnId;
  outcome: TurnOutcome;
  summary: string;
  stopReason?: TurnStopReason;
  stepCount?: number;
  filesChanged?: string[];
  edits?: AppliedEdit[];
  validations?: ValidationResult[];
  risks?: string[];
  notes?: string[];
  projectInstructions?: ProjectInstructionSource[];
  mutatingActions?: MutatingActionReport[];
  nextSteps?: PlanItem[];
}

export interface RepositoryChangeClassification {
  preExistingChangedFiles: string[];
  currentRunChangedFiles: string[];
  touchedPreExistingFiles: string[];
}

export interface RepositoryStateReport {
  initialBranch?: string;
  finalBranch?: string;
  wasDirtyBeforeRun: boolean;
  isDirtyAfterRun: boolean;
  snapshotBefore?: GitWorkingTreeSnapshot;
  snapshotAfter?: GitWorkingTreeSnapshot;
  changeClassification?: RepositoryChangeClassification;
}

export interface SessionReport {
  sessionId: SessionId;
  outcome: SessionOutcome;
  summary: string;
  turnReports: TurnReport[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  artifactPath?: string;
  followUpFromSessionId?: SessionId;
  notes?: string[];
  projectInstructions?: ProjectInstructionSource[];
  mutatingActions?: MutatingActionReport[];
  repositoryState?: RepositoryStateReport;
}
