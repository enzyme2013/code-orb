import { randomUUID } from "node:crypto";

import type { ApprovalRequestId, EventId, SessionId, StepId, ToolCallId, TurnId } from "@code-orb/schemas";

type RuntimeId =
  | ApprovalRequestId
  | EventId
  | SessionId
  | StepId
  | ToolCallId
  | TurnId;

export function createRuntimeId(prefix: string): RuntimeId {
  return `${prefix}_${randomUUID()}`;
}

export function createTimestamp(): string {
  return new Date().toISOString();
}
