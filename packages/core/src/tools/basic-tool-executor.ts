import type { ToolExecutionResult } from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import { BuiltinToolError } from "./builtin-tool-helpers.js";
import { createBuiltinToolRegistry } from "./builtin-tool-registry.js";
import type { ToolExecutionContext, ToolExecutionOutcome, ToolExecutor } from "./tool-executor.js";
import type { ToolRegistry } from "./tool-registry.js";

export class BasicToolExecutor implements ToolExecutor {
  constructor(private readonly registry: ToolRegistry = createBuiltinToolRegistry()) {}

  listTools() {
    return this.registry.list();
  }

  buildPolicyContext(request: Parameters<ToolExecutor["buildPolicyContext"]>[0], context: ToolExecutionContext) {
    return {
      sessionId: request.sessionId,
      turnId: request.turnId,
      stepId: request.stepId,
      cwd: context.cwd,
      repoRoot: context.cwd,
    };
  }

  async execute(request: Parameters<ToolExecutor["execute"]>[0], context: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    const registration = this.registry.get(request.toolName);

    if (!registration) {
      return createImmediateFailureOutcome(request, context.cwd, "unknown_tool", `Unknown tool: ${request.toolName}`);
    }

    let validatedInput = request.input;
    try {
      validatedInput = registration.validateInput ? registration.validateInput(request.input) : request.input;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Invalid input for tool: ${request.toolName}`;
      const details = error instanceof BuiltinToolError ? error.details : undefined;

      return createImmediateFailureOutcome(request, context.cwd, "invalid_tool_input", message, details);
    }

    const validatedRequest = {
      ...request,
      input: validatedInput,
    };

    const policyContext = this.buildPolicyContext(validatedRequest, context);
    const decision = await context.policyEngine.evaluate(validatedRequest, policyContext);

    if (decision.type === "deny") {
      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: validatedRequest.sessionId,
        turnId: validatedRequest.turnId,
        stepId: validatedRequest.stepId,
        type: "tool.denied",
        timestamp: createTimestamp(),
        payload: {
          request: validatedRequest,
          decision,
        },
      });

      return {
        decision,
        result: {
          callId: request.id,
          status: "denied",
          metadata: {
            startedAt: createTimestamp(),
            finishedAt: createTimestamp(),
            cwd: context.cwd,
          },
        },
      };
    }

    let approvalResponse;
    let approvalRequest;
    if (decision.type === "confirm" && decision.approvalRequest) {
      approvalRequest = decision.approvalRequest;

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: validatedRequest.sessionId,
        turnId: validatedRequest.turnId,
        stepId: validatedRequest.stepId,
        type: "approval.requested",
        timestamp: createTimestamp(),
        payload: {
          request: validatedRequest,
          approvalRequest,
        },
      });

      approvalResponse = await context.approvalResolver.resolve(approvalRequest);

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: validatedRequest.sessionId,
        turnId: validatedRequest.turnId,
        stepId: validatedRequest.stepId,
        type: "approval.completed",
        timestamp: createTimestamp(),
        payload: {
          request: validatedRequest,
          approvalRequest,
          approvalResponse,
        },
      });

      if (approvalResponse.decision !== "approved") {
        const deniedDecision = {
          type: "deny" as const,
          reason: "approval rejected",
        };

        context.eventSink.emit({
          id: createRuntimeId("evt"),
          sessionId: validatedRequest.sessionId,
          turnId: validatedRequest.turnId,
          stepId: validatedRequest.stepId,
          type: "tool.denied",
          timestamp: createTimestamp(),
          payload: {
            request: validatedRequest,
            decision: deniedDecision,
          },
        });

        return {
          decision: deniedDecision,
          approvalRequest,
          approvalResponse,
          result: {
            callId: request.id,
            status: "denied",
            metadata: {
              startedAt: createTimestamp(),
              finishedAt: createTimestamp(),
              cwd: context.cwd,
            },
          },
        };
      }
    }

    context.eventSink.emit({
      id: createRuntimeId("evt"),
      sessionId: validatedRequest.sessionId,
      turnId: validatedRequest.turnId,
      stepId: validatedRequest.stepId,
      type: "tool.started",
      timestamp: createTimestamp(),
      payload: {
        request: validatedRequest,
      },
    });

    const startedAt = createTimestamp();

    try {
      const output = await registration.execute(validatedInput, validatedRequest, context);
      const result: ToolExecutionResult = {
        callId: validatedRequest.id,
        status: "success",
        output,
        metadata: {
          startedAt,
          finishedAt: createTimestamp(),
          cwd: context.cwd,
          backend: registration.backend ?? "builtin",
        },
      };

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: validatedRequest.sessionId,
        turnId: validatedRequest.turnId,
        stepId: validatedRequest.stepId,
        type: "tool.finished",
        timestamp: createTimestamp(),
        payload: {
          result,
        },
      });

      return {
        decision,
        approvalRequest,
        approvalResponse,
        result,
      };
    } catch (error) {
      const result: ToolExecutionResult = {
        callId: validatedRequest.id,
        status: "error",
        metadata: {
          startedAt,
          finishedAt: createTimestamp(),
          cwd: context.cwd,
          backend: registration.backend ?? "builtin",
        },
        error: {
          code: error instanceof BuiltinToolError ? error.code : "tool_execution_failed",
          message: error instanceof Error ? error.message : "Unknown tool execution failure",
          details: error instanceof BuiltinToolError ? error.details : undefined,
        },
      };

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: validatedRequest.sessionId,
        turnId: validatedRequest.turnId,
        stepId: validatedRequest.stepId,
        type: "tool.finished",
        timestamp: createTimestamp(),
        payload: {
          result,
        },
      });

      return {
        decision,
        approvalRequest,
        approvalResponse,
        result,
      };
    }
  }
}

function createImmediateFailureOutcome(
  request: Parameters<ToolExecutor["execute"]>[0],
  cwd: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ToolExecutionOutcome {
  const result: ToolExecutionResult = {
    callId: request.id,
    status: "error",
    metadata: {
      startedAt: createTimestamp(),
      finishedAt: createTimestamp(),
      cwd,
    },
    error: {
      code,
      message,
      details,
    },
  };

  return {
    decision: {
      type: "deny",
      reason: message,
    },
    result,
  };
}
