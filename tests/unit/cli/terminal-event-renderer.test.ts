import { describe, expect, it } from "vitest";

import type { RuntimeEvent } from "@code-orb/schemas";

import { TerminalEventRenderer } from "../../../apps/cli/src/rendering/terminal-event-renderer";

function createRenderer() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const renderer = new TerminalEventRenderer({
    stdout: {
      write(message: string) {
        stdout.push(message);
      },
    },
    stderr: {
      write(message: string) {
        stderr.push(message);
      },
    },
  });

  return {
    renderer,
    stdout,
    stderr,
  };
}

describe("TerminalEventRenderer", () => {
  it("renders plan items and compatibility notes for assistant output", () => {
    const { renderer, stdout } = createRenderer();

    const assistantEvent: RuntimeEvent = {
      id: "evt_1",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "assistant.message",
      timestamp: new Date().toISOString(),
      payload: {
        content: "Planned task: inspect README.md",
        compatibility: {
          status: "degraded",
          path: "responses_streaming_fallback",
          notes: ["Recovered assistant content through streaming fallback."],
        },
      },
    };

    const planEvent: RuntimeEvent = {
      id: "evt_2",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "plan.generated",
      timestamp: new Date().toISOString(),
      payload: {
        plan: {
          summary: "Inspect README.md and report the next action.",
          items: [
            {
              id: "plan_1",
              content: "Read README.md",
              status: "completed",
            },
            {
              id: "plan_2",
              content: "Summarize the next action",
              status: "pending",
            },
          ],
        },
      },
    };

    renderer.render(assistantEvent);
    renderer.render(planEvent);

    const output = stdout.join("");
    expect(output).toContain("Assistant: Planned task: inspect README.md");
    expect(output).toContain("Provider compatibility: degraded (responses_streaming_fallback)");
    expect(output).toContain("Compatibility note: Recovered assistant content through streaming fallback.");
    expect(output).toContain("Plan: Inspect README.md and report the next action.");
    expect(output).toContain("Plan completed: Read README.md");
    expect(output).toContain("Plan pending: Summarize the next action");
  });

  it("renders approval details and richer turn summaries", () => {
    const { renderer, stdout } = createRenderer();

    const approvalEvent: RuntimeEvent = {
      id: "evt_3",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "approval.requested",
      timestamp: new Date().toISOString(),
      payload: {
        request: {
          id: "call_1",
          sessionId: "ses_1",
          turnId: "turn_1",
          toolName: "apply_patch",
          input: {
            path: "README.md",
          },
          requestedAt: new Date().toISOString(),
        },
        approvalRequest: {
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
        },
      },
    };

    const turnCompletedEvent: RuntimeEvent = {
      id: "evt_4",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "turn.completed",
      timestamp: new Date().toISOString(),
      payload: {
        report: {
          sessionId: "ses_1",
          turnId: "turn_1",
          outcome: "completed",
          summary: "Updated README.md and verified the result.",
          stopReason: "task_completed",
          stepCount: 4,
          filesChanged: ["README.md"],
          edits: [
            {
              mode: "targeted_replacement",
              path: "README.md",
              changed: true,
              toolName: "apply_patch",
            },
          ],
          validations: [
            {
              name: "node verify.mjs",
              status: "passed",
            },
          ],
          nextSteps: [
            {
              id: "next_1",
              content: "Consider running a broader test suite if more files change.",
              status: "pending",
            },
          ],
        },
      },
    };

    renderer.render(approvalEvent);
    renderer.render(turnCompletedEvent);

    const output = stdout.join("");
    expect(output).toContain("Approval requested: Approve apply_patch on README.md");
    expect(output).toContain("Path: README.md");
    expect(output).toContain("Operation: targeted_replacement");
    expect(output).toContain("Search preview:");
    expect(output).toContain("Replace preview:");
    expect(output).toContain("Approval scope: once");
    expect(output).toContain("Turn complete: Updated README.md and verified the result.");
    expect(output).toContain("Stop reason: task_completed");
    expect(output).toContain("Steps: 4");
    expect(output).toContain("Edit targeted_replacement: README.md");
    expect(output).toContain("Next step pending: Consider running a broader test suite if more files change.");
  });

  it("truncates long apply_patch tool input previews", () => {
    const { renderer, stdout } = createRenderer();

    renderer.render({
      id: "evt_5",
      sessionId: "ses_1",
      turnId: "turn_1",
      type: "tool.started",
      timestamp: new Date().toISOString(),
      payload: {
        request: {
          id: "call_2",
          sessionId: "ses_1",
          turnId: "turn_1",
          toolName: "apply_patch",
          input: {
            path: "README.md",
            searchText: "",
            replaceText: ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"].join("\n"),
          },
          requestedAt: new Date().toISOString(),
        },
      },
    });

    const output = stdout.join("");
    expect(output).toContain("Tool started: apply_patch");
    expect(output).toContain("Operation: full_write");
    expect(output).toContain("Replace preview:");
    expect(output).toContain("  line 1");
    expect(output).toContain("  ...");
    expect(output).not.toContain("line 6");
  });
});
