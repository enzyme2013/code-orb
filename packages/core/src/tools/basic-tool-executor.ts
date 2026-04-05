import { spawn } from "node:child_process";

import type { ToolDefinition, ToolExecutionResult } from "@code-orb/schemas";

import { createRuntimeId, createTimestamp } from "../internal/runtime-utils.js";
import {
  BuiltinToolError,
  listRepositoryFiles,
  readRepositoryFile,
  replaceInRepositoryFile,
  resolveRepoPath,
  searchRepositoryText,
} from "./builtin-tool-helpers.js";
import type { ToolExecutionContext, ToolExecutionOutcome, ToolExecutor } from "./tool-executor.js";

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  list_files: {
    name: "list_files",
    description: "List repository files",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
  },
  read_file: {
    name: "read_file",
    description: "Read a repository file",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
  },
  search_text: {
    name: "search_text",
    description: "Search repository text",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
  },
  apply_patch: {
    name: "apply_patch",
    description: "Apply a controlled replacement in a repository file",
    kind: "editing",
    mutability: "mutating",
    approvalRequirement: "confirm",
  },
  run_command: {
    name: "run_command",
    description: "Run a shell command in the repository",
    kind: "execution",
    mutability: "mutating",
    approvalRequirement: "confirm",
  },
};

export class BasicToolExecutor implements ToolExecutor {
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
    const definition = TOOL_DEFINITIONS[request.toolName];

    if (!definition) {
      const result: ToolExecutionResult = {
        callId: request.id,
        status: "error",
        metadata: {
          startedAt: createTimestamp(),
          finishedAt: createTimestamp(),
          cwd: context.cwd,
        },
        error: {
          code: "unknown_tool",
          message: `Unknown tool: ${request.toolName}`,
        },
      };

      return {
        decision: {
          type: "deny",
          reason: `Unknown tool: ${request.toolName}`,
        },
        result,
      };
    }

    const policyContext = this.buildPolicyContext(request, context);
    const decision = await context.policyEngine.evaluate(request, policyContext);

    if (decision.type === "deny") {
      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: request.sessionId,
        turnId: request.turnId,
        stepId: request.stepId,
        type: "tool.denied",
        timestamp: createTimestamp(),
        payload: {
          request,
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
    if (decision.type === "confirm" && decision.approvalRequest) {
      approvalResponse = await context.approvalResolver.resolve(decision.approvalRequest);
      if (approvalResponse.decision !== "approved") {
        const deniedDecision = {
          type: "deny" as const,
          reason: "approval rejected",
        };

        context.eventSink.emit({
          id: createRuntimeId("evt"),
          sessionId: request.sessionId,
          turnId: request.turnId,
          stepId: request.stepId,
          type: "tool.denied",
          timestamp: createTimestamp(),
          payload: {
            request,
            decision: deniedDecision,
          },
        });

        return {
          decision: deniedDecision,
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
      sessionId: request.sessionId,
      turnId: request.turnId,
      stepId: request.stepId,
      type: "tool.started",
      timestamp: createTimestamp(),
      payload: {
        request,
      },
    });

    const startedAt = createTimestamp();

    try {
      const output = await this.runBuiltinTool(request, context.cwd);
      const result: ToolExecutionResult = {
        callId: request.id,
        status: "success",
        output,
        metadata: {
          startedAt,
          finishedAt: createTimestamp(),
          cwd: context.cwd,
          backend: "builtin",
        },
      };

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: request.sessionId,
        turnId: request.turnId,
        stepId: request.stepId,
        type: "tool.finished",
        timestamp: createTimestamp(),
        payload: {
          result,
        },
      });

      return {
        decision,
        approvalResponse,
        result,
      };
    } catch (error) {
      const result: ToolExecutionResult = {
        callId: request.id,
        status: "error",
        metadata: {
          startedAt,
          finishedAt: createTimestamp(),
          cwd: context.cwd,
          backend: "builtin",
        },
        error: {
          code: error instanceof BuiltinToolError ? error.code : "tool_execution_failed",
          message: error instanceof Error ? error.message : "Unknown tool execution failure",
          details: error instanceof BuiltinToolError ? error.details : undefined,
        },
      };

      context.eventSink.emit({
        id: createRuntimeId("evt"),
        sessionId: request.sessionId,
        turnId: request.turnId,
        stepId: request.stepId,
        type: "tool.finished",
        timestamp: createTimestamp(),
        payload: {
          result,
        },
      });

      return {
        decision,
        approvalResponse,
        result,
      };
    }
  }

  private async runBuiltinTool(request: Parameters<ToolExecutor["execute"]>[0], cwd: string): Promise<unknown> {
    switch (request.toolName) {
      case "list_files":
        return {
          files: await listRepositoryFiles(cwd),
        };
      case "read_file":
        return {
          path: String(request.input.path),
          content: await readRepositoryFile(cwd, String(request.input.path)),
        };
      case "search_text":
        return {
          query: String(request.input.query),
          matches: await searchRepositoryText(cwd, String(request.input.query)),
        };
      case "apply_patch":
        return replaceInRepositoryFile(
          cwd,
          String(request.input.path),
          String(request.input.searchText),
          String(request.input.replaceText),
        );
      case "run_command":
        return runShellCommand(String(request.input.command), cwd);
      default:
        throw new Error(`Unsupported builtin tool: ${request.toolName}`);
    }
  }
}

async function runShellCommand(command: string, cwd: string): Promise<{
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolveResult({
        command,
        cwd,
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
      });
    });
  });
}
