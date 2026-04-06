import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BasicAgentEngine,
  BasicSessionRunner,
  BasicToolExecutor,
  LocalGitStateReader,
  LocalSessionStore,
  MemoryEventSink,
} from "@code-orb/core";

import {
  AllowAllPolicyEngine,
  AutoApproveResolver,
  FakeModelClient,
  FailingModelClient,
  NoopToolExecutor,
  ScriptedToolExecutor,
} from "../../helpers/runtime-fakes";
import { ensureGitRepository, runGit } from "../../helpers/git";

describe("BasicSessionRunner", () => {
  it("runs a minimal session-turn-step flow and emits runtime events", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();

    try {
      const report = await runner.run(
        {
          cwd,
          task: "summarize the next action",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient("Create a short execution summary."),
          gitStateReader: new LocalGitStateReader(),
          sessionStore: new LocalSessionStore(),
        },
      );

      expect(report.outcome).toBe("completed");
      expect(report.turnReports).toHaveLength(1);
      expect(report.summary).toBe("Create a short execution summary.");
      expect(report.turnReports[0]?.nextSteps?.[0]?.status).toBe("pending");
      expect(report.artifactPath).toContain(`${join(".orb", "sessions", `${report.sessionId}.json`)}`);
      expect(eventSink.events.map((event) => event.type)).toEqual([
        "session.started",
        "turn.started",
        "step.started",
        "plan.generated",
        "turn.completed",
        "session.completed",
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("emits an error event when the agent turn fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();

    try {
      await expect(
        runner.run(
          {
            cwd,
            task: "summarize the next action",
          },
          {
            eventSink,
            agentEngine: new BasicAgentEngine(),
            toolExecutor: new NoopToolExecutor(),
            policyEngine: new AllowAllPolicyEngine(),
            approvalResolver: new AutoApproveResolver(),
            modelClient: new FailingModelClient("model unavailable"),
            gitStateReader: new LocalGitStateReader(),
            sessionStore: new LocalSessionStore(),
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

      const artifacts = await new LocalSessionStore().list(cwd);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.outcome).toBe("failed");
      expect(artifacts[0]?.summary).toBe("model unavailable");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns a failed turn report when an edit target cannot be applied", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();
    let callCount = 0;

    try {
      const report = await runner.run(
        {
          cwd,
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
          gitStateReader: new LocalGitStateReader(),
          sessionStore: new LocalSessionStore(),
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
      expect(report.artifactPath).toContain(`${join(".orb", "sessions", `${report.sessionId}.json`)}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("persists git snapshots before and after a run in git-backed repositories", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    await ensureGitRepository(cwd);
    await runGit(["config", "user.name", "Code Orb Tests"], cwd);
    await runGit(["config", "user.email", "code-orb-tests@example.com"], cwd);

    try {
      await runGit(["commit", "--allow-empty", "-m", "initial"], cwd);
      await import("node:fs/promises").then(({ writeFile }) => writeFile(join(cwd, "README.md"), "hello\n", "utf8"));
      await runGit(["add", "README.md"], cwd);
      await import("node:fs/promises").then(({ writeFile }) => writeFile(join(cwd, "README.md"), "hello again\n", "utf8"));
      await import("node:fs/promises").then(({ writeFile }) => writeFile(join(cwd, "notes.txt"), "todo\n", "utf8"));

      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: "summarize the next action",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient("Create a short execution summary."),
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const artifact = await sessionStore.load(cwd, report.sessionId);
      expect(artifact?.gitSnapshotBefore?.isGitRepository).toBe(true);
      expect(artifact?.gitSnapshotBefore?.branch).toBeTruthy();
      expect(artifact?.gitSnapshotBefore?.stagedFiles).toEqual(["README.md"]);
      expect(artifact?.gitSnapshotBefore?.unstagedFiles).toEqual(["README.md"]);
      expect(artifact?.gitSnapshotBefore?.untrackedFiles).toEqual(["notes.txt"]);
      expect(artifact?.gitSnapshotAfter).toEqual(artifact?.gitSnapshotBefore);
      expect(report.repositoryState?.wasDirtyBeforeRun).toBe(true);
      expect(report.repositoryState?.isDirtyAfterRun).toBe(true);
      expect(report.repositoryState?.changeClassification).toEqual({
        preExistingChangedFiles: ["README.md", "notes.txt"],
        currentRunChangedFiles: [],
        touchedPreExistingFiles: [],
      });
      expect(artifact?.changeClassification).toEqual(report.repositoryState?.changeClassification);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("classifies current-run edits separately from pre-existing dirty files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    await ensureGitRepository(cwd);
    await runGit(["config", "user.name", "Code Orb Tests"], cwd);
    await runGit(["config", "user.email", "code-orb-tests@example.com"], cwd);

    try {
      await runGit(["commit", "--allow-empty", "-m", "initial"], cwd);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(cwd, "README.md"), "__CODE_ORB_PLACEHOLDER__\n", "utf8");
      await runGit(["add", "README.md"], cwd);
      await runGit(["commit", "-m", "add readme"], cwd);
      await writeFile(join(cwd, "notes.txt"), "todo\n", "utf8");
      await runGit(["add", "notes.txt"], cwd);

      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: 'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node -e "process.exit(0)"',
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new BasicToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient("Create a short execution summary."),
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      expect(report.repositoryState?.changeClassification).toEqual({
        preExistingChangedFiles: ["notes.txt"],
        currentRunChangedFiles: ["README.md"],
        touchedPreExistingFiles: [],
      });

      const artifact = await sessionStore.load(cwd, report.sessionId);
      expect(artifact?.changeClassification).toEqual(report.repositoryState?.changeClassification);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("records follow-up linkage and forwards prior-session context to planning", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();
    const initialModelClient = new FakeModelClient("Initial summary.");
    const followUpModelClient = new FakeModelClient("Follow-up summary.");

    try {
      const runner = new BasicSessionRunner();
      const initialReport = await runner.run(
        {
          cwd,
          task: "summarize the next action",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: initialModelClient,
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const priorArtifact = await sessionStore.load(cwd, initialReport.sessionId);
      if (!priorArtifact) {
        throw new Error("expected prior artifact");
      }

      const followUpReport = await runner.run(
        {
          cwd,
          task: "continue the prior work",
          metadata: {
            followUpContext: {
              priorSessionId: priorArtifact.sessionId,
              priorTask: priorArtifact.task,
              priorOutcome: priorArtifact.outcome,
              priorSummary: priorArtifact.summary,
              priorChangedFiles: priorArtifact.changedFiles,
              priorValidations: priorArtifact.validations,
              priorRisks: priorArtifact.risks,
            },
          },
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: followUpModelClient,
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      expect(followUpReport.followUpFromSessionId).toBe(priorArtifact.sessionId);
      expect(followUpModelClient.requests[0]?.messages.some((message) => String(message.content).includes(priorArtifact.sessionId))).toBe(true);

      const savedFollowUp = await sessionStore.load(cwd, followUpReport.sessionId);
      expect(savedFollowUp?.followUpFromSessionId).toBe(priorArtifact.sessionId);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("supports multiple turns within one interactive session and persists one artifact", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();
    const modelClient = new FakeModelClient("Create a short execution summary.");

    try {
      const runner = new BasicSessionRunner();
      const session = runner.createSession({
        cwd,
        task: "Interactive CLI session",
        interactive: true,
      });

      const firstTurn = await runner.runTurn(
        session,
        {
          content: "summarize the next action",
          source: "user",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient,
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const secondTurn = await runner.runTurn(
        session,
        {
          content: "continue the prior work",
          source: "user",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new NoopToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient,
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const report = await runner.completeSession(session, {
        eventSink,
        agentEngine: new BasicAgentEngine(),
        toolExecutor: new NoopToolExecutor(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
        modelClient,
        gitStateReader: new LocalGitStateReader(),
        sessionStore,
      });

      expect(firstTurn.summary).toBe("Create a short execution summary.");
      expect(secondTurn.summary).toBe("Create a short execution summary.");
      expect(report.turnReports).toHaveLength(2);
      expect(report.outcome).toBe("completed");

      const artifacts = await sessionStore.list(cwd);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.turnReports).toHaveLength(2);
      expect(modelClient.requests).toHaveLength(2);
      expect(modelClient.requests[1]?.messages.some((message) => String(message.content).includes(`prior session ${session.id}`))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
