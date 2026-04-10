import type { PermissionDecision, PolicyContext, ToolCallRequest } from "@code-orb/schemas";

import { createRuntimeId } from "../internal/runtime-utils.js";
import { isPathWithinCwd, resolveRepoPath } from "../tools/builtin-tool-helpers.js";
import type { PolicyEngine } from "./policy-engine.js";

const READ_ONLY_TOOLS = new Set(["list_files", "read_file", "search_text"]);
const DANGEROUS_COMMAND_PATTERNS = ["rm -rf", "git reset --hard"];

export class MinimumPolicyEngine implements PolicyEngine {
  async evaluate(request: ToolCallRequest, context: PolicyContext): Promise<PermissionDecision> {
    if (READ_ONLY_TOOLS.has(request.toolName)) {
      return {
        type: "allow",
        reason: "read-only repository tool",
      };
    }

    if (request.toolName === "run_command") {
      const command = String(request.input.command ?? "");
      if (DANGEROUS_COMMAND_PATTERNS.some((pattern) => command.includes(pattern))) {
        return {
          type: "deny",
          reason: "dangerous command denied by minimum policy",
        };
      }
    }

    if (request.toolName === "apply_patch") {
      const targetPath = resolveRepoPath(context.cwd, String(request.input.path ?? ""));
      if (!isPathWithinCwd(context.cwd, targetPath)) {
        return {
          type: "deny",
          reason: "cannot write outside the repository",
        };
      }
    }

    return {
      type: "confirm",
      reason: "mutating tool requires confirmation",
      approvalRequest: {
        id: createRuntimeId("approval"),
        sessionId: request.sessionId,
        turnId: request.turnId,
        stepId: request.stepId,
        toolCallId: request.id,
        summary: buildApprovalSummary(request),
        scope: "once",
        details: buildApprovalDetails(request),
      },
    };
  }
}

function buildApprovalSummary(request: ToolCallRequest): string {
  if (request.toolName === "apply_patch") {
    return `Approve apply_patch on ${String(request.input.path ?? "unknown path")}`;
  }

  if (request.toolName === "run_command") {
    return `Approve run_command: ${String(request.input.command ?? "unknown command")}`;
  }

  return `Approve ${request.toolName}`;
}

function buildApprovalDetails(request: ToolCallRequest): Record<string, unknown> | undefined {
  if (request.toolName === "apply_patch") {
    const searchText = String(request.input.searchText ?? "");

    return {
      path: String(request.input.path ?? ""),
      operation: searchText.length > 0 ? "targeted_replacement" : "full_write",
      searchText,
      replaceText: String(request.input.replaceText ?? ""),
    };
  }

  if (request.toolName === "run_command") {
    return {
      command: String(request.input.command ?? ""),
    };
  }

  return undefined;
}
