import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MinimumPolicyEngine } from "@code-orb/core";

describe("MinimumPolicyEngine", () => {
  it("includes structured apply_patch approval details for shell review", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-policy-engine-"));
    const policyEngine = new MinimumPolicyEngine();

    try {
      const decision = await policyEngine.evaluate(
        {
          id: "call_1",
          sessionId: "ses_1",
          turnId: "turn_1",
          toolName: "apply_patch",
          input: {
            path: "README.md",
            searchText: "__CODE_ORB_PLACEHOLDER__",
            replaceText: "Hello, Code Orb!",
          },
          requestedAt: new Date().toISOString(),
        },
        {
          sessionId: "ses_1",
          turnId: "turn_1",
          cwd,
        },
      );

      expect(decision.type).toBe("confirm");
      expect(decision.approvalRequest?.details).toEqual({
        path: "README.md",
        operation: "targeted_replacement",
        searchText: "__CODE_ORB_PLACEHOLDER__",
        replaceText: "Hello, Code Orb!",
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
