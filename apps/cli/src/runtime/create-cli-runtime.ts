import {
  BasicAgentEngine,
  LocalGitStateReader,
  BasicSessionRunner,
  BasicToolExecutor,
  LocalSessionStore,
  MinimumPolicyEngine,
  type EventSink,
  type SessionRunner,
  type SessionRunnerContext,
} from "@code-orb/core";
import type { RuntimeEvent } from "@code-orb/schemas";

import type { CliIO } from "../main.js";
import { TerminalEventRenderer } from "../rendering/terminal-event-renderer.js";
import { CliApprovalResolver } from "./create-approval-resolver.js";
import { createModelClientFromEnv } from "./create-model-client.js";

class RenderingEventSink implements EventSink {
  constructor(private readonly renderer: TerminalEventRenderer) {}

  emit(event: RuntimeEvent): void {
    this.renderer.render(event);
  }
}

export interface CliRuntime {
  runner: SessionRunner;
  context: SessionRunnerContext;
}

export function createCliRuntime(io: CliIO): CliRuntime {
  const renderer = new TerminalEventRenderer(io);
  const eventSink = new RenderingEventSink(renderer);

  return {
    runner: new BasicSessionRunner(),
    context: {
      eventSink,
      agentEngine: new BasicAgentEngine(),
      toolExecutor: new BasicToolExecutor(),
      policyEngine: new MinimumPolicyEngine(),
      approvalResolver: new CliApprovalResolver(io),
      modelClient: createModelClientFromEnv(process.env),
      gitStateReader: new LocalGitStateReader(),
      sessionStore: new LocalSessionStore(),
    },
  };
}
