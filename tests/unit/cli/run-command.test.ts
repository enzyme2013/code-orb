import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { main } from "../../../apps/cli/src/main";
import { getCliUsage, parseCliArgs } from "../../../apps/cli/src/commands/run";

function createTestIO(cwd = "/repo") {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const prompts: string[] = [];
  const promptResponses: Array<string | null> = [];

  return {
    io: {
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
      cwd: () => cwd,
      confirm: async () => true,
      prompt: async (message: string) => {
        prompts.push(message);
        return promptResponses.shift() ?? null;
      },
    },
    stdout,
    stderr,
    prompts,
    promptResponses,
  };
}

describe("orb run command contract", () => {
  it("parses `orb run` into a session input", () => {
    const parsed = parseCliArgs(["run", "fix", "failing", "tests"], "/repo");

    expect(parsed.command).toBe("run");

    if (parsed.command !== "run") {
      throw new Error("expected run command");
    }

    expect(parsed.sessionInput).toEqual({
      cwd: "/repo",
      task: "fix failing tests",
    });
  });

  it("ignores a leading double-dash passed through script runners", () => {
    const parsed = parseCliArgs(["--", "run", "fix", "failing", "tests"], "/repo");

    expect(parsed.command).toBe("run");

    if (parsed.command !== "run") {
      throw new Error("expected run command");
    }

    expect(parsed.sessionInput.task).toBe("fix failing tests");
  });

  it("parses an explicit --cwd override", () => {
    const parsed = parseCliArgs(["--cwd", "benchmarks/failing-test-fix/repo", "run", "fix", "failing", "tests"], "/repo");

    expect(parsed.command).toBe("run");

    if (parsed.command !== "run") {
      throw new Error("expected run command");
    }

    expect(parsed.sessionInput).toEqual({
      cwd: "benchmarks/failing-test-fix/repo",
      task: "fix failing tests",
    });
  });

  it("parses `orb sessions list`", () => {
    const parsed = parseCliArgs(["sessions", "list"], "/repo");

    expect(parsed.command).toBe("sessions_list");

    if (parsed.command !== "sessions_list") {
      throw new Error("expected sessions_list command");
    }

    expect(parsed.cwd).toBe("/repo");
  });

  it("parses `orb sessions show <session-id>`", () => {
    const parsed = parseCliArgs(["sessions", "show", "ses_123"], "/repo");

    expect(parsed.command).toBe("sessions_show");

    if (parsed.command !== "sessions_show") {
      throw new Error("expected sessions_show command");
    }

    expect(parsed.cwd).toBe("/repo");
    expect(parsed.sessionId).toBe("ses_123");
  });

  it("parses `orb run --from-session <session-id>`", () => {
    const parsed = parseCliArgs(["run", "--from-session", "ses_123", "continue", "the", "task"], "/repo");

    expect(parsed.command).toBe("run");

    if (parsed.command !== "run") {
      throw new Error("expected run command");
    }

    expect(parsed.sessionInput.metadata).toEqual({
      followUpSessionId: "ses_123",
    });
    expect(parsed.sessionInput.task).toBe("continue the task");
  });

  it("parses `orb chat`", () => {
    const parsed = parseCliArgs(["chat"], "/repo");

    expect(parsed.command).toBe("chat");

    if (parsed.command !== "chat") {
      throw new Error("expected chat command");
    }

    expect(parsed.sessionInput).toEqual({
      cwd: "/repo",
      task: "Interactive CLI session",
      interactive: true,
    });
  });

  it("returns an invalid result when the task is missing", () => {
    const parsed = parseCliArgs(["run"], "/repo");

    expect(parsed.command).toBe("invalid");

    if (parsed.command !== "invalid") {
      throw new Error("expected invalid command");
    }

    expect(parsed.message).toContain("Missing task");
    expect(parsed.usage).toBe(getCliUsage());
  });

  it("prints help when no command is provided", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const exitCode = await main([], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("")).toBe(getCliUsage());
      expect(stdout.join("")).toContain("benchmark:failing-test-fix");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("accepts the run command at the contract level", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const exitCode = await main(["run", "summarize", "the", "next", "action"], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("")).toContain("Session started:");
      expect(stdout.join("")).toContain("Assistant: Planned task: summarize the next action");
      expect(stdout.join("")).toContain("Plan: Planned task: summarize the next action");
      expect(stdout.join("")).toContain("Session complete:");
      expect(stdout.join("")).toContain("Repository dirty before run: no");
      expect(stdout.join("")).toContain("Session artifact:");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runs an interactive chat session with help, status, and exit", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr, prompts, promptResponses } = createTestIO(cwd);
    promptResponses.push("/help", "summarize the next action", "/history", "/status", "/exit");

    try {
      const exitCode = await main(["chat"], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(prompts).toEqual(["orb> ", "orb> ", "orb> ", "orb> ", "orb> "]);

      const output = stdout.join("");
      expect(output).toContain("Interactive session started. Type /help for commands.");
      expect(output).toContain("Interactive commands:");
      expect(output).toContain("/history Show prior turns in this session");
      expect(output).toContain("Turn 1: summarize the next action");
      expect(output).toContain("Assistant: Planned task: summarize the next action");
      expect(output).toContain("Turn history:");
      expect(output).toContain("- Turn 1 | completed | Planned task: summarize the next action");
      expect(output).toContain("Session:");
      expect(output).toContain("Mode: interactive");
      expect(output).toContain("Turns: 1");
      expect(output).toContain("Interactive session exiting.");
      expect(output).toContain("Session complete:");
      expect(output).toContain("Session artifact:");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("executes assistant-produced generated rewrites through orb run and persists the explicit edit record", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);
    const originalKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    const originalFetch = globalThis.fetch;

    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_generated_rewrite",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: ["Here is the updated README:", "```md", "# Code Orb", "", "Generated by orb run.", "```"].join(
                  "\n",
                ),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    try {
      await writeFile(join(cwd, "README.md"), "old content\n", "utf8");

      const exitCode = await main(["run", "Rewrite README.md so it briefly explains this repository."], io);
      const output = stdout.join("");
      const readme = await readFile(join(cwd, "README.md"), "utf8");

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(readme).toBe("# Code Orb\n\nGenerated by orb run.\n");
      expect(output).toContain("Tool started: apply_patch");
      expect(output).toContain("Turn complete: Wrote README.md from assistant-generated content");

      const artifactLine = output
        .split("\n")
        .find((line) => line.startsWith("Session artifact: "));

      if (!artifactLine) {
        throw new Error("expected session artifact line");
      }

      const artifact = JSON.parse(
        await readFile(artifactLine.replace("Session artifact: ", "").trim(), "utf8"),
      ) as {
        turnReports?: Array<{
          edits?: Array<{
            mode?: string;
            path?: string;
            targetSource?: string;
          }>;
        }>;
      };

      expect(artifact.turnReports?.[0]?.edits).toEqual([
        {
          mode: "generated_rewrite",
          path: "README.md",
          changed: true,
          toolName: "apply_patch",
          targetSource: "task",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
      globalThis.fetch = originalFetch;

      if (originalKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalKey;
      }

      if (originalModel === undefined) {
        delete process.env.OPENAI_MODEL;
      } else {
        process.env.OPENAI_MODEL = originalModel;
      }

      if (originalBaseUrl === undefined) {
        delete process.env.OPENAI_BASE_URL;
      } else {
        process.env.OPENAI_BASE_URL = originalBaseUrl;
      }
    }
  });

  it("executes assistant-produced generated rewrites through orb chat and records the edit in the session artifact", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr, promptResponses } = createTestIO(cwd);
    const originalKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    const originalFetch = globalThis.fetch;

    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_chat_generated_rewrite",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: ["Updated README:", "```md", "# Chat Rewrite", "", "Generated by orb chat.", "```"].join("\n"),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    try {
      await writeFile(join(cwd, "README.md"), "old content\n", "utf8");
      promptResponses.push("Rewrite README.md so it says this file was generated by orb chat.", "/exit");

      const exitCode = await main(["chat"], io);
      const output = stdout.join("");
      const readme = await readFile(join(cwd, "README.md"), "utf8");

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(readme).toBe("# Chat Rewrite\n\nGenerated by orb chat.\n");
      expect(output).toContain("Turn complete: Wrote README.md from assistant-generated content");
      expect(output).toContain("Interactive session exiting.");

      const artifactLine = output
        .split("\n")
        .find((line) => line.startsWith("Session artifact: "));

      if (!artifactLine) {
        throw new Error("expected session artifact line");
      }

      const artifact = JSON.parse(
        await readFile(artifactLine.replace("Session artifact: ", "").trim(), "utf8"),
      ) as {
        turnReports?: Array<{
          edits?: Array<{
            mode?: string;
            path?: string;
            targetSource?: string;
          }>;
        }>;
      };

      expect(artifact.turnReports?.[0]?.edits).toEqual([
        {
          mode: "generated_rewrite",
          path: "README.md",
          changed: true,
          toolName: "apply_patch",
          targetSource: "task",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
      globalThis.fetch = originalFetch;

      if (originalKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalKey;
      }

      if (originalModel === undefined) {
        delete process.env.OPENAI_MODEL;
      } else {
        process.env.OPENAI_MODEL = originalModel;
      }

      if (originalBaseUrl === undefined) {
        delete process.env.OPENAI_BASE_URL;
      } else {
        process.env.OPENAI_BASE_URL = originalBaseUrl;
      }
    }
  });

  it("accepts plain `exit` as an interactive exit alias", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr, promptResponses } = createTestIO(cwd);
    promptResponses.push("exit");

    try {
      const exitCode = await main(["chat"], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);

      const output = stdout.join("");
      expect(output).toContain("Interactive session exiting.");
      expect(output).not.toContain("Turn 1: exit");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("accepts plain `quit` as an interactive exit alias", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr, promptResponses } = createTestIO(cwd);
    promptResponses.push("quit");

    try {
      const exitCode = await main(["chat"], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);

      const output = stdout.join("");
      expect(output).toContain("Interactive session exiting.");
      expect(output).not.toContain("Turn 1: quit");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("prints a clear runtime error when provider configuration is invalid", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);
    const originalKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;

    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_MODEL;

    try {
      const exitCode = await main(["run", "summarize", "the", "next", "action"], io);

      expect(exitCode).toBe(1);
      expect(stdout).toEqual([]);
      expect(stderr.join("")).toContain("OPENAI_API_KEY and OPENAI_MODEL must be set together");
    } finally {
      await rm(cwd, { recursive: true, force: true });

      if (originalKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalKey;
      }

      if (originalModel === undefined) {
        delete process.env.OPENAI_MODEL;
      } else {
        process.env.OPENAI_MODEL = originalModel;
      }
    }
  });

  it("lists saved sessions from the CLI", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const runExitCode = await main(["run", "summarize", "the", "next", "action"], io);
      expect(runExitCode).toBe(0);

      stdout.length = 0;
      stderr.length = 0;

      const listExitCode = await main(["sessions", "list"], io);

      expect(listExitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("")).toContain("Saved sessions:");
      expect(stdout.join("")).toContain("summarize the next action");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("shows a saved session from the CLI", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const runExitCode = await main(["run", "summarize", "the", "next", "action"], io);
      expect(runExitCode).toBe(0);

      const artifactLine = stdout
        .join("")
        .split("\n")
        .find((line) => line.startsWith("Session artifact: "));

      if (!artifactLine) {
        throw new Error("expected session artifact line");
      }

      const artifactPath = artifactLine.replace("Session artifact: ", "").trim();
      const sessionId = basename(artifactPath).replace(/\.json$/, "");

      if (!sessionId) {
        throw new Error("expected session id");
      }

      stdout.length = 0;
      stderr.length = 0;

      const showExitCode = await main(["sessions", "show", sessionId], io);

      expect(showExitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("")).toContain(`Session: ${sessionId}`);
      expect(stdout.join("")).toContain("Summary:");
      expect(stdout.join("")).toContain("Artifact:");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns an error when a requested session does not exist", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const exitCode = await main(["sessions", "show", "ses_missing"], io);

      expect(exitCode).toBe(1);
      expect(stdout).toEqual([]);
      expect(stderr.join("")).toContain("Session not found: ses_missing");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns an error when a follow-up session does not exist", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const exitCode = await main(["run", "--from-session", "ses_missing", "continue", "the", "task"], io);

      expect(exitCode).toBe(1);
      expect(stdout).toEqual([]);
      expect(stderr.join("")).toContain("Session not found: ses_missing");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runs a follow-up session from a saved session id", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-cli-test-"));
    const { io, stdout, stderr } = createTestIO(cwd);

    try {
      const firstExitCode = await main(["run", "summarize", "the", "next", "action"], io);
      expect(firstExitCode).toBe(0);

      const artifactLine = stdout
        .join("")
        .split("\n")
        .find((line) => line.startsWith("Session artifact: "));

      if (!artifactLine) {
        throw new Error("expected session artifact line");
      }

      const artifactPath = artifactLine.replace("Session artifact: ", "").trim();
      const sessionId = basename(artifactPath).replace(/\.json$/, "");

      if (!sessionId) {
        throw new Error("expected session id");
      }

      stdout.length = 0;
      stderr.length = 0;

      const secondExitCode = await main(["run", "--from-session", sessionId, "continue", "the", "task"], io);

      expect(secondExitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("")).toContain(`Follow-up from session: ${sessionId}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
