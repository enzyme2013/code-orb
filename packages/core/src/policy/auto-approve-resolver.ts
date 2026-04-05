import type { ApprovalRequest, ApprovalResponse } from "@code-orb/schemas";

import { createTimestamp } from "../internal/runtime-utils.js";
import type { ApprovalResolver } from "./policy-engine.js";

export class AutoApproveResolver implements ApprovalResolver {
  async resolve(request: ApprovalRequest): Promise<ApprovalResponse> {
    return {
      requestId: request.id,
      decision: "approved",
      scope: request.scope,
      respondedAt: createTimestamp(),
    };
  }
}
