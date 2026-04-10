import { describe, expect, it } from "vitest";

import { CliApprovalResolver, formatApprovalPrompt } from "../../../apps/cli/src/runtime/create-approval-resolver";

describe("CliApprovalResolver", () => {
  it("formats apply_patch approval prompts with structured previews", async () => {
    const messages: string[] = [];
    const resolver = new CliApprovalResolver({
      stdout: { write() {} },
      stderr: { write() {} },
      cwd: () => "/repo",
      confirm: async (message: string) => {
        messages.push(message);
        return true;
      },
    });

    await resolver.resolve({
      id: "approval_1",
      sessionId: "ses_1",
      turnId: "turn_1",
      toolCallId: "call_1",
      summary: "Approve apply_patch on README.md",
      scope: "once",
      details: {
        path: "README.md",
        operation: "targeted_replacement",
        searchText: "__CODE_ORB_PLACEHOLDER__",
        replaceText: "Hello, Code Orb!",
      },
    });

    const prompt = messages[0] ?? "";
    expect(prompt).toContain("Approval request");
    expect(prompt).toContain("Summary: Approve apply_patch on README.md");
    expect(prompt).toContain("Path: README.md");
    expect(prompt).toContain("Operation: targeted_replacement");
    expect(prompt).toContain("Search preview:");
    expect(prompt).toContain("__CODE_ORB_PLACEHOLDER__");
    expect(prompt).toContain("Replace preview:");
    expect(prompt).toContain("Hello, Code Orb!");
    expect(prompt).toContain("Approval scope: once");
    expect(prompt).toContain("Approve request?");
  });

  it("truncates long multiline previews in approval prompts", () => {
    const prompt = formatApprovalPrompt({
      id: "approval_2",
      sessionId: "ses_1",
      turnId: "turn_1",
      toolCallId: "call_2",
      summary: "Approve apply_patch on README.md",
      scope: "once",
      details: {
        path: "README.md",
        operation: "full_write",
        searchText: "",
        replaceText: ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"].join("\n"),
      },
    });

    expect(prompt).toContain("Replace preview:");
    expect(prompt).toContain("  line 1");
    expect(prompt).toContain("  line 4");
    expect(prompt).toContain("  ...");
    expect(prompt).not.toContain("line 6");
  });
});
