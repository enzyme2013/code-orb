import type { SessionInput, SessionReport, SessionRuntimeState, TurnInput, TurnRuntimeState } from "@code-orb/schemas";

import type { ModelClient } from "../adapters/ports/model-client.js";
import type { GitStateReader } from "../adapters/git/git-state-reader.js";
import type { AgentEngine } from "../engine/agent-engine.js";
import type { EventSink } from "../events/event-sink.js";
import type { ApprovalResolver, PolicyEngine } from "../policy/policy-engine.js";
import type { SessionStore } from "./session-store.js";
import type { ToolExecutor } from "../tools/tool-executor.js";

export interface SessionRunnerContext {
  eventSink: EventSink;
  agentEngine: AgentEngine;
  toolExecutor: ToolExecutor;
  policyEngine: PolicyEngine;
  approvalResolver: ApprovalResolver;
  modelClient: ModelClient;
  gitStateReader: GitStateReader;
  sessionStore: SessionStore;
}

export interface SessionRunner {
  run(input: SessionInput, context: SessionRunnerContext): Promise<SessionReport>;
  createSession(input: SessionInput): SessionRuntimeState;
  createTurn(session: SessionRuntimeState, input: TurnInput): TurnRuntimeState;
}
