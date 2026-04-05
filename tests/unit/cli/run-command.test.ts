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
    const { io, stdout, stderr } = createTestIO();

    const exitCode = await main([], io);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toBe(getCliUsage());
  });

  it("accepts the run command at the contract level", async () => {
    const { io, stdout, stderr } = createTestIO();

    const exitCode = await main(["run", "summarize", "the", "next", "action"], io);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("Session started:");
    expect(stdout.join("")).toContain("Plan: Planned task: summarize the next action");
    expect(stdout.join("")).toContain("Session complete:");
  });
});
