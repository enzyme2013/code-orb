import { spawn } from "node:child_process";

import type { ToolCallRequest, ToolDefinition } from "@code-orb/schemas";

import {
  BuiltinToolError,
  listRepositoryFiles,
  readRepositoryFile,
  replaceInRepositoryFile,
  searchRepositoryText,
} from "./builtin-tool-helpers.js";
import type { ToolExecutionContext } from "./tool-executor.js";
import { StaticToolRegistry, type RegisteredTool, type ToolRegistry } from "./tool-registry.js";

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  list_files: {
    name: "list_files",
    description: "List repository files",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  read_file: {
    name: "read_file",
    description: "Read a repository file",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository-relative path to read.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  search_text: {
    name: "search_text",
    description: "Search repository text",
    kind: "context",
    mutability: "read_only",
    approvalRequirement: "auto",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text query to search for inside the repository.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  apply_patch: {
    name: "apply_patch",
    description: "Apply a controlled replacement in a repository file",
    kind: "editing",
    mutability: "mutating",
    approvalRequirement: "confirm",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository-relative path to update.",
        },
        searchText: {
          type: "string",
          description: "Existing text to replace. Use an empty string to create or fully rewrite a file.",
        },
        replaceText: {
          type: "string",
          description: "Replacement text to write into the file.",
        },
      },
      required: ["path", "searchText", "replaceText"],
      additionalProperties: false,
    },
  },
  run_command: {
    name: "run_command",
    description: "Run a shell command in the repository",
    kind: "execution",
    mutability: "mutating",
    approvalRequirement: "confirm",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute in the repository root.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
};

export function createBuiltinToolRegistry(): ToolRegistry {
  return new StaticToolRegistry([
    {
      definition: TOOL_DEFINITIONS.list_files,
      execute: async (_input, _request, context) => ({
        files: await listRepositoryFiles(context.cwd),
      }),
    },
    {
      definition: TOOL_DEFINITIONS.read_file,
      validateInput: (input) => ({
        path: requireStringInput("read_file", input, "path"),
      }),
      execute: async (input, _request, context) => ({
        path: String(input.path),
        content: await readRepositoryFile(context.cwd, String(input.path)),
      }),
    },
    {
      definition: TOOL_DEFINITIONS.search_text,
      validateInput: (input) => ({
        query: requireStringInput("search_text", input, "query"),
      }),
      execute: async (input, _request, context) => ({
        query: String(input.query),
        matches: await searchRepositoryText(context.cwd, String(input.query)),
      }),
    },
    {
      definition: TOOL_DEFINITIONS.apply_patch,
      validateInput: (input) => ({
        path: requireStringInput("apply_patch", input, "path"),
        searchText: requireStringInput("apply_patch", input, "searchText"),
        replaceText: requireStringInput("apply_patch", input, "replaceText"),
      }),
      execute: async (input, _request, context) =>
        replaceInRepositoryFile(
          context.cwd,
          String(input.path),
          String(input.searchText),
          String(input.replaceText),
        ),
    },
    {
      definition: TOOL_DEFINITIONS.run_command,
      validateInput: (input) => ({
        command: requireStringInput("run_command", input, "command"),
      }),
      execute: async (input, _request, context) => runShellCommand(String(input.command), context.cwd),
    },
  ]);
}

function requireStringInput(toolName: string, input: Record<string, unknown>, field: string): string {
  const value = input[field];

  if (typeof value !== "string") {
    throw new BuiltinToolError(`Invalid input for ${toolName}: expected ${field} to be a string`, "invalid_tool_input", {
      toolName,
      field,
      expected: "string",
    });
  }

  return value;
}

async function runShellCommand(command: string, cwd: string): Promise<{
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolveResult({
        command,
        cwd,
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
      });
    });
  });
}

export function createBuiltinToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_DEFINITIONS);
}
