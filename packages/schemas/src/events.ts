import type { EventId, SessionId, StepId, Timestamp, TurnId } from "./ids.js";
import type { ModelProfile, ProviderCompatibility } from "./model.js";
import type { PermissionDecision } from "./policy.js";
import type { AppliedEdit, SessionReport, TurnReport, ValidationResult } from "./report.js";
import type { TurnPlan } from "./runtime.js";
import type { ToolCallRequest, ToolExecutionResult } from "./tools.js";

export type RuntimeEventType =
  | "session.started"
  | "turn.started"
  | "step.started"
  | "assistant.message"
  | "plan.generated"
  | "edit.applied"
  | "tool.started"
  | "tool.finished"
  | "tool.denied"
  | "verify.started"
  | "verify.finished"
  | "turn.completed"
  | "session.completed"
  | "error.raised";

export interface RuntimeEventEnvelope<TType extends RuntimeEventType, TPayload> {
  id: EventId;
  sessionId: SessionId;
  turnId?: TurnId;
  stepId?: StepId;
  type: TType;
  timestamp: Timestamp;
  payload: TPayload;
}

export type SessionStartedEvent = RuntimeEventEnvelope<
  "session.started",
  {
    task: string;
    cwd: string;
  }
>;

export type TurnStartedEvent = RuntimeEventEnvelope<
  "turn.started",
  {
    index: number;
    input: string;
  }
>;

export type StepStartedEvent = RuntimeEventEnvelope<
  "step.started",
  {
    index: number;
    kind: string;
  }
>;

export type AssistantMessageEvent = RuntimeEventEnvelope<
  "assistant.message",
  {
    content: string;
    profile?: ModelProfile;
    provider?: string;
    model?: string;
    compatibility?: ProviderCompatibility;
  }
>;

export type PlanGeneratedEvent = RuntimeEventEnvelope<
  "plan.generated",
  {
    plan: TurnPlan;
    profile?: ModelProfile;
  }
>;

export type EditAppliedEvent = RuntimeEventEnvelope<
  "edit.applied",
  {
    edit: AppliedEdit;
  }
>;

export type ToolStartedEvent = RuntimeEventEnvelope<
  "tool.started",
  {
    request: ToolCallRequest;
  }
>;

export type ToolFinishedEvent = RuntimeEventEnvelope<
  "tool.finished",
  {
    result: ToolExecutionResult;
  }
>;

export type ToolDeniedEvent = RuntimeEventEnvelope<
  "tool.denied",
  {
    request: ToolCallRequest;
    decision: PermissionDecision;
  }
>;

export type VerifyStartedEvent = RuntimeEventEnvelope<
  "verify.started",
  {
    command?: string;
  }
>;

export type VerifyFinishedEvent = RuntimeEventEnvelope<
  "verify.finished",
  {
    validations: ValidationResult[];
  }
>;

export type TurnCompletedEvent = RuntimeEventEnvelope<
  "turn.completed",
  {
    report: TurnReport;
  }
>;

export type SessionCompletedEvent = RuntimeEventEnvelope<
  "session.completed",
  {
    report: SessionReport;
  }
>;

export type ErrorRaisedEvent = RuntimeEventEnvelope<
  "error.raised",
  {
    code: string;
    message: string;
    retryable?: boolean;
  }
>;

export type RuntimeEvent =
  | SessionStartedEvent
  | TurnStartedEvent
  | StepStartedEvent
  | AssistantMessageEvent
  | PlanGeneratedEvent
  | EditAppliedEvent
  | ToolStartedEvent
  | ToolFinishedEvent
  | ToolDeniedEvent
  | VerifyStartedEvent
  | VerifyFinishedEvent
  | TurnCompletedEvent
  | SessionCompletedEvent
  | ErrorRaisedEvent;
