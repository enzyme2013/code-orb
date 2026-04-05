import type { PermissionDecision, PolicyContext, ToolCallRequest } from "@code-orb/schemas";

import type { PolicyEngine } from "./policy-engine.js";

export class AllowAllPolicyEngine implements PolicyEngine {
  async evaluate(_request: ToolCallRequest, _context: PolicyContext): Promise<PermissionDecision> {
    return {
      type: "allow",
      reason: "allowed by development policy",
    };
  }
}
