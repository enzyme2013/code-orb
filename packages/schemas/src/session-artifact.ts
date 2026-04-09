import type { SessionId, Timestamp } from "./ids.js";
import type {
  MutatingActionReport,
  ProjectInstructionSource,
  RepositoryChangeClassification,
  SessionOutcome,
  TurnReport,
  ValidationResult,
} from "./report.js";

export interface GitWorkingTreeSnapshot {
  isGitRepository: boolean;
  branch?: string;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
  isDirty: boolean;
}

export interface SessionArtifact {
  schemaVersion: 1;
  sessionId: SessionId;
  task: string;
  cwd: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  savedAt: Timestamp;
  outcome: SessionOutcome;
  followUpFromSessionId?: SessionId;
  summary: string;
  notes?: string[];
  projectInstructions?: ProjectInstructionSource[];
  mutatingActions?: MutatingActionReport[];
  changedFiles: string[];
  validations: ValidationResult[];
  risks: string[];
  gitSnapshotBefore?: GitWorkingTreeSnapshot;
  gitSnapshotAfter?: GitWorkingTreeSnapshot;
  changeClassification?: RepositoryChangeClassification;
  turnReports: TurnReport[];
}
