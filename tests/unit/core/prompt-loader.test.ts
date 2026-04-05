import { describe, expect, it } from "vitest";

import { loadPromptAsset } from "@code-orb/core";

describe("prompt assets", () => {
  it("loads repository-managed prompt assets", async () => {
    const systemPrompt = await loadPromptAsset("system/base.md");
    const plannerPrompt = await loadPromptAsset("planner/failing-test-fix.md");

    expect(systemPrompt).toContain("You are Code Orb");
    expect(plannerPrompt).toContain("Task type: failing test fix.");
  });
});
