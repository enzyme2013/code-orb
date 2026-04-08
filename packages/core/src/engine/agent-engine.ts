import type { ModelProfile, StepRuntimeState, TurnReport, TurnRuntimeState } from "@code-orb/schemas";
import type { FollowUpContext } from "@code-orb/schemas";

import type { ModelClient } from "../adapters/ports/model-client.js";
import type { ProviderRuntime } from "../adapters/provider-runtime.js";
import type { EventSink } from "../events/event-sink.js";
import type { ApprovalResolver, PolicyEngine } from "../policy/policy-engine.js";
import type { ToolExecutor } from "../tools/tool-executor.js";
import type { ToolOrchestrator } from "../tools/tool-orchestrator.js";

export interface AgentExecutionContext {
  cwd: string;
  defaultProfile: ModelProfile;
  eventSink: EventSink;
  modelClient: ModelClient;
  toolExecutor: ToolExecutor;
  toolOrchestrator: ToolOrchestrator;
  providerRuntime: ProviderRuntime;
  policyEngine: PolicyEngine;
  approvalResolver: ApprovalResolver;
  followUpContext?: FollowUpContext;
}

export interface AgentEngine {
  runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport>;
  runStep(step: StepRuntimeState, context: AgentExecutionContext): Promise<StepRuntimeState>;
}
