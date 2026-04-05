import type { SessionId, Timestamp, TurnId } from "./ids.js";
import type { PlanItem } from "./runtime.js";

export type ValidationStatus = "passed" | "failed" | "skipped";
export type TurnOutcome = "completed" | "failed" | "blocked";
export type SessionOutcome = "completed" | "failed" | "cancelled";

export interface ValidationResult {
  name: string;
  status: ValidationStatus;
  details?: string;
}

export interface TurnReport {
  sessionId: SessionId;
  turnId: TurnId;
  outcome: TurnOutcome;
  summary: string;
  filesChanged?: string[];
  validations?: ValidationResult[];
  risks?: string[];
  nextSteps?: PlanItem[];
}

export interface SessionReport {
  sessionId: SessionId;
  outcome: SessionOutcome;
  summary: string;
  turnReports: TurnReport[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
}
