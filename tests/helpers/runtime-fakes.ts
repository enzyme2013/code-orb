import type {
  ApprovalRequest,
  ApprovalResponse,
  ModelRequest,
  ModelResponse,
  PermissionDecision,
  PolicyContext,
  ToolCallRequest,
  ToolExecutionResult,
  ToolExecutionOutcome,
} from "@code-orb/schemas";
import type {
  ApprovalResolver,
  ModelClient,
  PolicyEngine,
  ToolExecutionContext,
  ToolExecutor,
} from "@code-orb/core";

export class FakeModelClient implements ModelClient {
  readonly provider = "fake-provider";
  readonly capabilities = {
    toolCalling: false,
    streaming: false,
    structuredOutput: false,
  };

  constructor(private readonly content: string) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    return {
      provider: this.provider,
      model: "fake-model",
      profile: request.profile,
      content: this.content,
      finishReason: "stop",
    };
  }
}

export class FailingModelClient implements ModelClient {
  readonly provider = "fake-provider";
  readonly capabilities = {
    toolCalling: false,
    streaming: false,
    structuredOutput: false,
  };

  constructor(private readonly message: string) {}

  async complete(_request: ModelRequest): Promise<ModelResponse> {
    throw new Error(this.message);
  }
}

export class AllowAllPolicyEngine implements PolicyEngine {
  async evaluate(_request: ToolCallRequest, _context: PolicyContext): Promise<PermissionDecision> {
    return {
      type: "allow",
      reason: "allowed in fake policy engine",
    };
  }
}

export class AutoApproveResolver implements ApprovalResolver {
  async resolve(request: ApprovalRequest): Promise<ApprovalResponse> {
    return {
      requestId: request.id,
      decision: "approved",
      scope: request.scope,
      respondedAt: new Date().toISOString(),
    };
  }
}

export class NoopToolExecutor implements ToolExecutor {
  buildPolicyContext(_request: ToolCallRequest, context: ToolExecutionContext): PolicyContext {
    return {
      sessionId: "ses_fake",
      turnId: "turn_fake",
      cwd: context.cwd,
    };
  }

  async execute(request: ToolCallRequest, _context: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    return {
      decision: {
        type: "allow",
        reason: "no-op tool executor",
      },
      result: {
        callId: request.id,
        status: "success",
        output: null,
        metadata: {
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        },
      },
    };
  }
}

export class ScriptedToolExecutor implements ToolExecutor {
  constructor(
    private readonly handler: (request: ToolCallRequest, context: ToolExecutionContext) => Promise<ToolExecutionResult>,
  ) {}

  buildPolicyContext(_request: ToolCallRequest, context: ToolExecutionContext): PolicyContext {
    return {
      sessionId: "ses_fake",
      turnId: "turn_fake",
      cwd: context.cwd,
    };
  }

  async execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    return {
      decision: {
        type: "allow",
        reason: "scripted tool executor",
      },
      result: await this.handler(request, context),
    };
  }
}
