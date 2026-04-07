import type { SessionId, StepId, TurnId } from "./ids.js";
import type { ToolDefinition, ToolName } from "./tools.js";

export type ModelProfile = string;
export type ModelMessageRole = "system" | "user" | "assistant" | "tool";
export type ModelFinishReason = "stop" | "tool_calls" | "length" | "error" | "cancelled";
export type ProviderCompatibilityStatus = "native" | "compatible" | "degraded";
export type ProviderCompatibilityPath =
  | "responses_output"
  | "responses_output_text"
  | "chat_completions_choices"
  | "responses_streaming_fallback";

export interface ProviderCapabilities {
  toolCalling: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  maxContextTokens?: number;
}

export interface ProviderCompatibility {
  status: ProviderCompatibilityStatus;
  path: ProviderCompatibilityPath;
  notes?: string[];
}

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  name: ToolName;
  input: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelRequest {
  sessionId: SessionId;
  turnId: TurnId;
  stepId?: StepId;
  profile: ModelProfile;
  messages: ModelMessage[];
  tools?: ToolDefinition[];
  maxOutputTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  provider: string;
  model: string;
  profile: ModelProfile;
  content: string;
  compatibility?: ProviderCompatibility;
  toolCalls?: ModelToolCall[];
  finishReason: ModelFinishReason;
  usage?: ModelUsage;
  raw?: Record<string, unknown>;
}
