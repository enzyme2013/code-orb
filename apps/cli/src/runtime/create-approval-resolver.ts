import type { ApprovalRequest, ApprovalResponse } from "@code-orb/schemas";

import type { CliIO } from "../main.js";
import { formatApprovalDetailLines } from "../rendering/terminal-formatting.js";

export class CliApprovalResolver {
  constructor(private readonly io: CliIO) {}

  async resolve(request: ApprovalRequest): Promise<ApprovalResponse> {
    const confirm = this.io.confirm;

    if (!confirm) {
      return {
        requestId: request.id,
        decision: "approved",
        scope: request.scope,
        respondedAt: new Date().toISOString(),
      };
    }

    const approved = await confirm(formatApprovalPrompt(request));

    return {
      requestId: request.id,
      decision: approved ? "approved" : "rejected",
      scope: request.scope,
      respondedAt: new Date().toISOString(),
    };
  }
}

export function formatApprovalPrompt(request: ApprovalRequest): string {
  return [
    "Approval request\n",
    `Summary: ${request.summary}\n`,
    ...formatApprovalDetailLines(request.details, request.scope),
    "\nApprove request?",
  ].join("");
}
