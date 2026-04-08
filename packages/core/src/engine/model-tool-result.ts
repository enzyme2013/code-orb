import type { ToolCanonicalResult, ToolExecutionResult, ToolModelOutput } from "@code-orb/schemas";

export function createCanonicalToolResult(result: ToolExecutionResult): ToolCanonicalResult {
  return {
    result,
    modelOutput: createToolModelOutput(result),
  };
}

export function createToolModelOutput(result: ToolExecutionResult): ToolModelOutput {
  if (result.status === "success") {
    return buildModelOutput(result.output);
  }

  return buildModelOutput({
    status: result.status,
    error: result.error ?? {
      code: "tool_execution_failed",
      message: "Tool execution failed before producing a usable result.",
    },
  });
}

export function serializeToolResultForModel(result: ToolExecutionResult): string {
  return createToolModelOutput(result).content;
}

function buildModelOutput(value: unknown): ToolModelOutput {
  if (typeof value === "string") {
    return {
      format: "text",
      content: value,
    };
  }

  return {
    format: "json",
    content: JSON.stringify(value ?? null),
  };
}
