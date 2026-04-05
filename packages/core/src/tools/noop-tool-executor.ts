import type { PolicyContext, ToolCallRequest } from "@code-orb/schemas";

import { createTimestamp } from "../internal/runtime-utils.js";
import type { ToolExecutionContext, ToolExecutionOutcome, ToolExecutor } from "./tool-executor.js";

export class NoopToolExecutor implements ToolExecutor {
  buildPolicyContext(request: ToolCallRequest, context: ToolExecutionContext): PolicyContext {
    return {
      sessionId: request.sessionId,
      turnId: request.turnId,
      stepId: request.stepId,
      cwd: context.cwd,
    };
  }

  async execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    const decision = await context.policyEngine.evaluate(request, this.buildPolicyContext(request, context));

    return {
      decision,
      result: {
        callId: request.id,
        status: decision.type === "deny" ? "denied" : "success",
        output: null,
        metadata: {
          startedAt: createTimestamp(),
          finishedAt: createTimestamp(),
          cwd: context.cwd,
        },
      },
    };
  }
}
