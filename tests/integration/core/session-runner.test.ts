import { describe, expect, it } from "vitest";

import { BasicAgentEngine, BasicSessionRunner, MemoryEventSink } from "@code-orb/core";

import {
  AllowAllPolicyEngine,
  AutoApproveResolver,
  FakeModelClient,
  FailingModelClient,
  NoopToolExecutor,
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
});
