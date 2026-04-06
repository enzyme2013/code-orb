import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { main } from "../../../apps/cli/src/main";
import { getCliUsage, parseCliArgs } from "../../../apps/cli/src/commands/run";

function createTestIO(cwd = "/repo") {
  const stdout: string[] = [];
  const stderr: string[] = [];

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
    },
    stdout,
    stderr,
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
      expect(stdout.join("")).toContain("Plan: Planned task: summarize the next action");
      expect(stdout.join("")).toContain("Session complete:");
      expect(stdout.join("")).toContain("Repository dirty before run: no");
      expect(stdout.join("")).toContain("Session artifact:");
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
      const artifactSegments = artifactPath.split("/");
      const sessionId = artifactSegments[artifactSegments.length - 1]?.replace(/\.json$/, "");

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
      const artifactSegments = artifactPath.split("/");
      const sessionId = artifactSegments[artifactSegments.length - 1]?.replace(/\.json$/, "");

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
