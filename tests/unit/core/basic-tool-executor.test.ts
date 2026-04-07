import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BasicToolExecutor, MemoryEventSink } from "../../../packages/core/src/index";

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
});
