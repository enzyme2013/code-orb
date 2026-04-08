import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BasicToolExecutor, MemoryEventSink, StaticToolRegistry } from "../../../packages/core/src/index";

import { AllowAllPolicyEngine, AutoApproveResolver } from "../../helpers/runtime-fakes";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("BasicToolExecutor", () => {
  it("creates a new file when apply_patch is given an empty search text", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-tool-executor-"));
    tempDirs.push(cwd);

    const executor = new BasicToolExecutor();
    const outcome = await executor.execute(
      {
        id: "call_create",
        sessionId: "ses_test",
        turnId: "turn_test",
        stepId: "step_test",
        toolName: "apply_patch",
        input: {
          path: "scripts/show-disk-space.sh",
          searchText: "",
          replaceText: "#!/bin/sh\ndf -h /\n",
        },
        requestedAt: new Date().toISOString(),
      },
      {
        cwd,
        eventSink: new MemoryEventSink(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
      },
    );

    expect(outcome.result.status).toBe("success");
    expect(outcome.result.output).toEqual({
      path: "scripts/show-disk-space.sh",
      replaced: true,
      created: true,
    });
    expect(await readFile(join(cwd, "scripts", "show-disk-space.sh"), "utf8")).toBe("#!/bin/sh\ndf -h /\n");
  });

  it("classifies apply_patch target-not-found failures", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-tool-executor-"));
    tempDirs.push(cwd);

    await writeFile(join(cwd, "README.md"), "hello\n", "utf8");

    const executor = new BasicToolExecutor();
    const outcome = await executor.execute(
      {
        id: "call_test",
        sessionId: "ses_test",
        turnId: "turn_test",
        stepId: "step_test",
        toolName: "apply_patch",
        input: {
          path: "README.md",
          searchText: "missing",
          replaceText: "updated",
        },
        requestedAt: new Date().toISOString(),
      },
      {
        cwd,
        eventSink: new MemoryEventSink(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
      },
    );

    expect(outcome.result.status).toBe("error");
    expect(outcome.result.error?.code).toBe("edit_target_not_found");
    expect(outcome.result.error?.details).toEqual({
      path: "README.md",
      searchText: "missing",
    });
    expect(await readFile(join(cwd, "README.md"), "utf8")).toBe("hello\n");
  });

  it("returns an explicit unknown-tool error when no registration exists", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-tool-executor-"));
    tempDirs.push(cwd);

    const executor = new BasicToolExecutor();
    const outcome = await executor.execute(
      {
        id: "call_unknown",
        sessionId: "ses_test",
        turnId: "turn_test",
        stepId: "step_test",
        toolName: "missing_tool",
        input: {},
        requestedAt: new Date().toISOString(),
      },
      {
        cwd,
        eventSink: new MemoryEventSink(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
      },
    );

    expect(outcome.result.status).toBe("error");
    expect(outcome.result.error?.code).toBe("unknown_tool");
    expect(outcome.result.error?.message).toBe("Unknown tool: missing_tool");
  });

  it("validates tool input before dispatching to the backend", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-tool-executor-"));
    tempDirs.push(cwd);

    const executor = new BasicToolExecutor();
    const outcome = await executor.execute(
      {
        id: "call_invalid",
        sessionId: "ses_test",
        turnId: "turn_test",
        stepId: "step_test",
        toolName: "read_file",
        input: {
          path: 123,
        },
        requestedAt: new Date().toISOString(),
      },
      {
        cwd,
        eventSink: new MemoryEventSink(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
      },
    );

    expect(outcome.result.status).toBe("error");
    expect(outcome.result.error?.code).toBe("invalid_tool_input");
    expect(outcome.result.error?.details).toEqual({
      toolName: "read_file",
      field: "path",
      expected: "string",
    });
  });

  it("can execute a registry-provided tool without changing executor-local code", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "code-orb-tool-executor-"));
    tempDirs.push(cwd);

    const executor = new BasicToolExecutor(
      new StaticToolRegistry([
        {
          definition: {
            name: "custom_echo",
            description: "Echo validated input",
            kind: "context",
            mutability: "read_only",
            approvalRequirement: "auto",
          },
          backend: "custom_registry",
          validateInput: (input) => ({
            value: String(input.value ?? ""),
          }),
          execute: async (input) => ({
            echoed: input.value,
          }),
        },
      ]),
    );

    const outcome = await executor.execute(
      {
        id: "call_custom",
        sessionId: "ses_test",
        turnId: "turn_test",
        stepId: "step_test",
        toolName: "custom_echo",
        input: {
          value: "hello",
        },
        requestedAt: new Date().toISOString(),
      },
      {
        cwd,
        eventSink: new MemoryEventSink(),
        policyEngine: new AllowAllPolicyEngine(),
        approvalResolver: new AutoApproveResolver(),
      },
    );

    expect(outcome.result.status).toBe("success");
    expect(outcome.result.output).toEqual({
      echoed: "hello",
    });
    expect(outcome.result.metadata.backend).toBe("custom_registry");
  });

  it("lists tool definitions from the active registry boundary", () => {
    const executor = new BasicToolExecutor(
      new StaticToolRegistry([
        {
          definition: {
            name: "custom_echo",
            description: "Echo validated input",
            kind: "context",
            mutability: "read_only",
            approvalRequirement: "auto",
          },
          execute: async () => ({
            echoed: true,
          }),
        },
      ]),
    );

    expect(executor.listTools()).toEqual([
      {
        name: "custom_echo",
        description: "Echo validated input",
        kind: "context",
        mutability: "read_only",
        approvalRequirement: "auto",
      },
    ]);
  });
});
