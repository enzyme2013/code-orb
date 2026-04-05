import type { ApprovalRequest, ApprovalResponse } from "@code-orb/schemas";

import type { CliIO } from "../main.js";

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

    const approved = await confirm(`${request.summary}`);

    return {
      requestId: request.id,
      decision: approved ? "approved" : "rejected",
      scope: request.scope,
      respondedAt: new Date().toISOString(),
    };
  }
}
