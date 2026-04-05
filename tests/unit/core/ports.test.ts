import { describe, expect, it } from "vitest";

import type { ApprovalResolver, EventSink, ModelClient, PolicyEngine, ToolExecutor } from "@code-orb/core";

describe("core ports", () => {
  it("exposes the core runtime ports needed for phase 1", () => {
    const surface = {
      eventSink: {} as EventSink,
      modelClient: {} as ModelClient,
      policyEngine: {} as PolicyEngine,
      approvalResolver: {} as ApprovalResolver,
      toolExecutor: {} as ToolExecutor,
    };

    expect(Object.keys(surface)).toEqual([
      "eventSink",
      "modelClient",
      "policyEngine",
      "approvalResolver",
      "toolExecutor",
    ]);
  });
});
