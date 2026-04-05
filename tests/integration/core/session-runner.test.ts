import { describe, expect, it } from "vitest";

import { BasicAgentEngine, BasicSessionRunner, MemoryEventSink } from "@code-orb/core";

import {
  AllowAllPolicyEngine,
  AutoApproveResolver,
  FakeModelClient,
  FailingModelClient,
  NoopToolExecutor,
  ScriptedToolExecutor,
} from "../../helpers/runtime-fakes";

describe("BasicSessionRunner", () => {
  it("runs a minimal session-turn-step flow and emits runtime events", async () => {
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();

    const report = await runner.run(
      {
        cwd: "/repo",
        task: "summarize the next action",
      },
      {
        eventSink,
        agentEngine: new BasicAgentEngine(),
        toolExecutor: new NoopToolExecutor(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
        modelClient: new FakeModelClient("Create a short execution summary."),
      },
    );

    expect(report.outcome).toBe("completed");
    expect(report.turnReports).toHaveLength(1);
    expect(report.summary).toBe("Create a short execution summary.");
    expect(report.turnReports[0]?.nextSteps?.[0]?.status).toBe("pending");
    expect(eventSink.events.map((event) => event.type)).toEqual([
      "session.started",
      "turn.started",
      "step.started",
      "plan.generated",
      "turn.completed",
      "session.completed",
    ]);
  });

  it("emits an error event when the agent turn fails", async () => {
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();

    await expect(
      runner.run(
        {
          cwd: "/repo",
          task: "summarize the next action",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FailingModelClient("model unavailable"),
        },
      ),
    ).rejects.toThrow("model unavailable");

    expect(eventSink.events.map((event) => event.type)).toEqual([
      "session.started",
      "turn.started",
      "step.started",
      "error.raised",
    ]);

    const lastEvent = eventSink.events[eventSink.events.length - 1];

    expect(lastEvent?.type).toBe("error.raised");
    if (lastEvent?.type === "error.raised") {
      expect(lastEvent.payload.message).toBe("model unavailable");
    }
  });

  it("returns a failed turn report when an edit target cannot be applied", async () => {
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();
    let callCount = 0;

    const report = await runner.run(
      {
        cwd: "/repo",
        task: 'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
      },
      {
        eventSink,
        agentEngine: new BasicAgentEngine(),
        toolExecutor: new ScriptedToolExecutor(async (request) => {
          callCount += 1;

          if (request.toolName === "search_text") {
            return {
              callId: request.id,
              status: "success",
              output: {
                matches: [
                  {
                    path: "README.md",
                    line: 1,
                    preview: "__CODE_ORB_PLACEHOLDER__",
                  },
                ],
              },
              metadata: {
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
              },
            };
          }

          if (request.toolName === "read_file") {
            return {
              callId: request.id,
              status: "success",
              output: {
                path: "README.md",
                content: "__CODE_ORB_PLACEHOLDER__\n",
              },
              metadata: {
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
              },
            };
          }

          if (request.toolName === "apply_patch") {
            return {
              callId: request.id,
              status: "error",
              metadata: {
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
              },
              error: {
                code: "edit_target_not_found",
                message: "Search text not found in README.md",
                details: {
                  path: "README.md",
                  searchText: "__CODE_ORB_PLACEHOLDER__",
                },
              },
            };
          }

          throw new Error(`Unexpected tool call: ${request.toolName}`);
        }),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
        modelClient: new FakeModelClient("Create a short execution summary."),
      },
    );

    expect(callCount).toBe(3);
    expect(report.outcome).toBe("failed");
    expect(report.turnReports[0]?.outcome).toBe("failed");
    expect(report.turnReports[0]?.summary).toBe(
      "Could not apply apply_patch because the expected edit target was not found.",
    );
    expect(report.turnReports[0]?.filesChanged).toEqual(["README.md"]);
    expect(report.turnReports[0]?.validations).toBeUndefined();
    expect(report.turnReports[0]?.risks).toEqual([
      "The requested edit could not be applied because the target text no longer matched the file.",
    ]);
  });
});
