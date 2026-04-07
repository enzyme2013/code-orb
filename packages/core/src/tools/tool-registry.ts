import type { ToolCallRequest, ToolDefinition } from "@code-orb/schemas";

import type { ToolExecutionContext } from "./tool-executor.js";

export interface RegisteredTool {
  definition: ToolDefinition;
  backend?: string;
  validateInput?(input: Record<string, unknown>): Record<string, unknown>;
  execute(input: Record<string, unknown>, request: ToolCallRequest, context: ToolExecutionContext): Promise<unknown>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  get(toolName: string): RegisteredTool | undefined;
}

export class StaticToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(registrations: RegisteredTool[]) {
    for (const registration of registrations) {
      this.tools.set(registration.definition.name, registration);
    }
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((registration) => registration.definition);
  }

  get(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }
}
