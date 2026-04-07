import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BasicAgentEngine,
  BasicSessionRunner,
  BasicToolExecutor,
  LocalGitStateReader,
  LocalSessionStore,
  MemoryEventSink,
  OpenAIResponsesModelClient,
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
        "assistant.message",
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

  it("records degraded provider compatibility metadata in assistant events after streaming fallback recovery", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const runner = new BasicSessionRunner();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resp_empty",
          output: [],
        }),
      } as Response)
      .mockResolvedValueOnce(
        new Response(
          [
            "event: response.output_text.delta",
            'data: {"type":"response.output_text.delta","delta":"compatibility recovered"}',
            "",
            "event: response.output_text.done",
            'data: {"type":"response.output_text.done","text":"compatibility recovered"}',
            "",
          ].join("\n"),
          {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
            },
          },
        ),
      );

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
          modelClient: new OpenAIResponsesModelClient({
            apiKey: "test-key",
            model: "gpt-test",
            baseUrl: "https://example.com/v1",
            fetchImpl,
          }),
          gitStateReader: new LocalGitStateReader(),
          sessionStore: new LocalSessionStore(),
        },
      );

      expect(report.outcome).toBe("completed");

      const assistantEvent = eventSink.events.find((event) => event.type === "assistant.message");
      expect(assistantEvent?.type).toBe("assistant.message");
      if (assistantEvent?.type === "assistant.message") {
        expect(assistantEvent.payload.compatibility).toEqual({
          status: "degraded",
          path: "responses_streaming_fallback",
          notes: ["Recovered assistant content through streaming fallback after an empty non-streaming response."],
        });
      }
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

  it("documents the current loop contract through step kinds and explicit edit and verification events", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    try {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(cwd, "README.md"), "__CODE_ORB_PLACEHOLDER__\n", "utf8");
      await writeFile(
        join(cwd, "verify.mjs"),
        [
          'import { readFileSync } from "node:fs";',
          'const content = readFileSync("README.md", "utf8");',
          'if (!content.includes("Hello, Code Orb!")) process.exit(1);',
        ].join("\n"),
        "utf8",
      );

      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: 'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
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

      expect(report.outcome).toBe("completed");
      expect(eventSink.events.filter((event) => event.type === "step.started").map((event) => event.payload.kind)).toEqual([
        "planning",
        "context",
        "tool_use",
        "verification",
      ]);
      expect(eventSink.events.some((event) => event.type === "edit.applied")).toBe(true);
      expect(eventSink.events.some((event) => event.type === "verify.started")).toBe(true);
      expect(eventSink.events.some((event) => event.type === "verify.finished")).toBe(true);
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

  it("creates a shell script file from assistant-generated code when the task asks for a new script", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    try {
      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: "写一个脚本，显示我的硬盘剩余空间。",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new BasicToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient(
            [
              "我会写一个 shell 脚本来显示磁盘剩余空间：",
              "```sh",
              "#!/bin/sh",
              "df -h /",
              "```",
            ].join("\n"),
          ),
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const { readFile } = await import("node:fs/promises");
      const scriptContent = await readFile(join(cwd, "show-disk-space.sh"), "utf8");

      expect(report.outcome).toBe("completed");
      expect(report.turnReports[0]?.filesChanged).toEqual(["show-disk-space.sh"]);
      expect(report.turnReports[0]?.edits).toEqual([
        {
          mode: "generated_create",
          path: "show-disk-space.sh",
          changed: true,
          toolName: "apply_patch",
          created: true,
          targetSource: "inferred",
        },
      ]);
      expect(report.turnReports[0]?.summary).toBe("Wrote show-disk-space.sh from assistant-generated content");
      expect(scriptContent).toBe("#!/bin/sh\ndf -h /\n");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("writes the assistant-suggested shell script filename for the Chinese disk-space request", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    try {
      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: "我想写一个 shell脚本,查看硬盘的可用空间",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new BasicToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient(
            [
              "可以，给你一个简单实用的 Shell 脚本，用来查看硬盘可用空间（按人类可读格式显示）：",
              "",
              "```bash",
              "#!/bin/bash",
              "",
              "echo \"=== 磁盘空间使用情况 ===\"",
              "df -h",
              "",
              "echo",
              "echo \"=== 各挂载点可用空间（Available） ===\"",
              "df -h | awk 'NR==1 || NR>1 {print $1, $6, $4}'",
              "```",
              "",
              "### 使用方法",
              "1. 保存为 `check_disk.sh`",
              "2. 赋予执行权限：",
              "   ```bash",
              "   chmod +x check_disk.sh",
              "   ```",
              "3. 运行：",
              "   ```bash",
              "   ./check_disk.sh",
              "   ```",
              "",
              "如果你想只看根分区 `/` 的可用空间，也可以再改。",
            ].join("\n"),
          ),
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const { readFile } = await import("node:fs/promises");
      const scriptContent = await readFile(join(cwd, "check_disk.sh"), "utf8");

      expect(report.outcome).toBe("completed");
      expect(report.turnReports[0]?.filesChanged).toEqual(["check_disk.sh"]);
      expect(report.turnReports[0]?.edits).toEqual([
        {
          mode: "generated_create",
          path: "check_disk.sh",
          changed: true,
          toolName: "apply_patch",
          created: true,
          targetSource: "assistant",
        },
      ]);
      expect(report.turnReports[0]?.summary).toBe("Wrote check_disk.sh from assistant-generated content");
      expect(scriptContent).toContain("#!/bin/bash");
      expect(scriptContent).toContain('echo "=== 磁盘空间使用情况 ==="');
      expect(scriptContent).toContain("df -h");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rewrites an existing file from assistant-generated content when the task explicitly targets that file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    try {
      const { writeFile, readFile } = await import("node:fs/promises");
      await writeFile(join(cwd, "README.md"), "old content\n", "utf8");

      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: "Rewrite README.md so it briefly explains this repository.",
        },
        {
          eventSink,
          agentEngine: new BasicAgentEngine(),
          toolExecutor: new BasicToolExecutor(),
          policyEngine: new AllowAllPolicyEngine(),
          approvalResolver: new AutoApproveResolver(),
          modelClient: new FakeModelClient(
            [
              "Here is the updated README:",
              "```md",
              "# Code Orb",
              "",
              "Code Orb is a CLI-first coding agent for local repositories.",
              "```",
            ].join("\n"),
          ),
          gitStateReader: new LocalGitStateReader(),
          sessionStore,
        },
      );

      const readme = await readFile(join(cwd, "README.md"), "utf8");

      expect(report.outcome).toBe("completed");
      expect(report.turnReports[0]?.filesChanged).toEqual(["README.md"]);
      expect(report.turnReports[0]?.edits).toEqual([
        {
          mode: "generated_rewrite",
          path: "README.md",
          changed: true,
          toolName: "apply_patch",
          targetSource: "task",
        },
      ]);
      expect(report.turnReports[0]?.summary).toBe("Wrote README.md from assistant-generated content");
      expect(readme).toBe("# Code Orb\n\nCode Orb is a CLI-first coding agent for local repositories.\n");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("records targeted replacement edits explicitly for replace-and-verify tasks", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-session-runner-"));
    const eventSink = new MemoryEventSink();
    const sessionStore = new LocalSessionStore();

    try {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(cwd, "README.md"), "__CODE_ORB_PLACEHOLDER__\n", "utf8");
      await writeFile(
        join(cwd, "verify.mjs"),
        [
          'import { readFileSync } from "node:fs";',
          'const content = readFileSync("README.md", "utf8");',
          'if (!content.includes("Hello, Code Orb!")) process.exit(1);',
        ].join("\n"),
        "utf8",
      );

      const runner = new BasicSessionRunner();
      const report = await runner.run(
        {
          cwd,
          task: 'Update README.md by replacing "__CODE_ORB_PLACEHOLDER__" with "Hello, Code Orb!" and then run node verify.mjs',
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

      expect(report.outcome).toBe("completed");
      expect(report.turnReports[0]?.edits).toEqual([
        {
          mode: "targeted_replacement",
          path: "README.md",
          changed: true,
          toolName: "apply_patch",
        },
      ]);

      const editEvent = eventSink.events.find((event) => event.type === "edit.applied");
      expect(editEvent?.type).toBe("edit.applied");
      if (editEvent?.type === "edit.applied") {
        expect(editEvent.payload.edit.mode).toBe("targeted_replacement");
        expect(editEvent.payload.edit.path).toBe("README.md");
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
