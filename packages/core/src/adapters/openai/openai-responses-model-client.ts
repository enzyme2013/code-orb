import type {
  ModelContinuationState,
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelToolCall,
  ProviderCapabilities,
  ProviderCompatibility,
  ToolDefinition,
} from "@code-orb/schemas";

import type { ModelClient } from "../ports/model-client.js";

interface OpenAIResponsesClientOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type OpenAIResponsesInputItem =
  | {
      role: ModelMessage["role"];
      content: string;
    }
  | {
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };

interface OpenAIResponsesRequestBody {
  model: string;
  input: OpenAIResponsesInputItem[];
  previous_response_id?: string;
  tools?: OpenAIResponsesTool[];
  tool_choice?: "auto";
  max_output_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenAIResponsesTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

interface OpenAIResponsesApiResponse {
  output_text?: string;
  id?: string;
  output?: Array<{
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    text?: string;
    content?: Array<{
      type?: string;
      text?: string | { value?: string; content?: string };
    }>;
  }>;
  choices?: Array<{
    text?: string;
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string | { value?: string; content?: string };
          }>;
      tool_calls?: Array<{
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

interface ExtractedCompatibilityResponse {
  content: string;
  toolCalls: ModelToolCall[];
  finishReason: ModelResponse["finishReason"];
  compatibility?: ProviderCompatibility;
  errorMessage?: string;
}

interface StreamingFallbackResult {
  content: string;
  toolCalls: ModelToolCall[];
}

interface RequestAttempt {
  requestBody: OpenAIResponsesRequestBody;
  responseBody: OpenAIResponsesApiResponse;
  usedContinuationFallback: boolean;
}

export class OpenAIResponsesModelClient implements ModelClient {
  readonly provider = "openai";
  readonly capabilities: ProviderCapabilities = {
    toolCalling: true,
    streaming: false,
    structuredOutput: false,
  };

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAIResponsesClientOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const primaryRequestBody = this.buildRequestBody(request);
    let attempted: RequestAttempt;

    try {
      attempted = await this.executeRequest(primaryRequestBody);
    } catch (error) {
      if (!primaryRequestBody.previous_response_id) {
        throw error;
      }

      attempted = await this.retryWithoutContinuation(request, primaryRequestBody, "transport_error", "transport_error");
    }

    let body = attempted.responseBody;
    let extracted = this.extractResponse(body);

    if (extracted.errorMessage) {
      throw new Error(
        `OpenAI-compatible provider returned an error payload for model ${this.options.model}: ${extracted.errorMessage}`,
      );
    }

    let content = extracted.content;
    let compatibility = extracted.compatibility;

    if (!content.trim() && extracted.toolCalls.length === 0 && primaryRequestBody.previous_response_id) {
      attempted = await this.retryWithoutContinuation(request, primaryRequestBody, attempted, "empty_response");
      body = attempted.responseBody;
      extracted = this.extractResponse(body);

      if (extracted.errorMessage) {
        throw new Error(
          `OpenAI-compatible provider returned an error payload for model ${this.options.model}: ${extracted.errorMessage}`,
        );
      }

      content = extracted.content;
      compatibility = extracted.compatibility;
    }

    if (!content.trim() && extracted.toolCalls.length === 0) {
      const streamingFallback = await this.completeViaStreamingFallback(attempted.requestBody);
      content = streamingFallback.content;

      if (streamingFallback.toolCalls.length > 0) {
        extracted.toolCalls = streamingFallback.toolCalls;
      }

      if (content.trim() || extracted.toolCalls.length > 0) {
        compatibility = {
          status: "degraded",
          path: "responses_streaming_fallback",
          notes: [
            extracted.toolCalls.length > 0
              ? "Recovered tool calls through streaming fallback after an empty non-streaming response."
              : "Recovered assistant content through streaming fallback after an empty non-streaming response.",
          ],
        };
      }
    }

    if (!content.trim() && extracted.toolCalls.length === 0) {
      throw new Error(
        `OpenAI-compatible provider returned no assistant content or tool calls for model ${this.options.model} after non-streaming normalization and streaming fallback.`,
      );
    }

    if (attempted.usedContinuationFallback) {
      compatibility = degradeCompatibility(
        compatibility,
        "Recovered by retrying without previous_response_id after continuation failed or returned no usable content.",
      );
    }

    return {
      provider: this.provider,
      model: this.options.model,
      profile: request.profile,
      content,
      compatibility,
      toolCalls: extracted.toolCalls.length > 0 ? extracted.toolCalls : undefined,
      finishReason: extracted.toolCalls.length > 0 ? "tool_calls" : extracted.finishReason,
      usage: {
        inputTokens: body.usage?.input_tokens,
        outputTokens: body.usage?.output_tokens,
        totalTokens: body.usage?.total_tokens,
      },
      raw: {
        id: body.id,
        compatibilityPath: compatibility?.path,
        compatibilityStatus: compatibility?.status,
      },
    };
  }

  private buildRequestBody(
    request: ModelRequest,
    options?: {
      disableContinuation?: boolean;
    },
  ): OpenAIResponsesRequestBody {
    const continuation = request.continuation;
    const tools = request.tools?.map((tool) => this.toResponsesTool(tool));

    const input = continuation
      ? this.buildContinuationInput(request.messages, continuation, options?.disableContinuation ?? false)
      : request.messages.flatMap((message) => this.toInputItems(message));

    return {
      model: this.options.model,
      input,
      previous_response_id: continuation && !options?.disableContinuation ? continuation.previousResponseId : undefined,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      max_output_tokens: request.maxOutputTokens,
      temperature: request.temperature,
    };
  }

  private buildContinuationInput(
    messages: ModelMessage[],
    continuation: ModelContinuationState,
    disableContinuation: boolean,
  ): OpenAIResponsesInputItem[] {
    if (!disableContinuation) {
      return messages.slice(continuation.continuationMessageIndex).flatMap((message) => this.toInputItems(message));
    }

    return messages.flatMap((message, index) =>
      this.toInputItems(
        message,
        index === continuation.continuationMessageIndex - 1 ? continuation.assistantToolCalls : undefined,
      ),
    );
  }

  private async executeRequest(body: OpenAIResponsesRequestBody): Promise<{
    requestBody: OpenAIResponsesRequestBody;
    responseBody: OpenAIResponsesApiResponse;
    usedContinuationFallback: boolean;
  }> {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI responses request failed (${response.status}): ${message}`);
    }

    return {
      requestBody: body,
      responseBody: (await response.json()) as OpenAIResponsesApiResponse,
      usedContinuationFallback: false,
    };
  }

  private async retryWithoutContinuation(
    request: ModelRequest,
    primaryBody: OpenAIResponsesRequestBody,
    attemptedOrReason: RequestAttempt | "transport_error",
    reason: "transport_error" | "empty_response",
  ): Promise<RequestAttempt> {
    const fallbackBody = this.buildRequestBody(request, {
      disableContinuation: true,
    });

    if (!primaryBody.previous_response_id) {
      if (attemptedOrReason === "transport_error") {
        throw new Error("Continuation retry was requested without a baseline response body.");
      }

      return attemptedOrReason;
    }

    try {
      const retried = await this.executeRequest(fallbackBody);
      return {
        ...retried,
        usedContinuationFallback: true,
      };
    } catch (error) {
      if (reason === "transport_error") {
        throw error;
      }

      if (attemptedOrReason === "transport_error") {
        throw error;
      }

      return attemptedOrReason;
    }
  }

  private async completeViaStreamingFallback(requestBody: OpenAIResponsesRequestBody): Promise<StreamingFallbackResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        ...requestBody,
        stream: true,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI streaming fallback request failed (${response.status}): ${message}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        content: "",
        toolCalls: [],
      };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let aggregated = "";
    const toolCalls = new Map<string, ModelToolCall>();

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = consumeSseBuffer(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        const update = extractUpdateFromSseEvent(event);
        if (update.text) {
          aggregated += update.text;
        }

        if (update.toolCall) {
          toolCalls.set(update.toolCall.id, update.toolCall);
        }
      }
    }

    if (buffer.trim()) {
      const parsed = consumeSseBuffer(`${buffer}\n\n`);
      for (const event of parsed.events) {
        const update = extractUpdateFromSseEvent(event);
        if (update.text) {
          aggregated += update.text;
        }

        if (update.toolCall) {
          toolCalls.set(update.toolCall.id, update.toolCall);
        }
      }
    }

    return {
      content: aggregated,
      toolCalls: [...toolCalls.values()],
    };
  }

  private toInputItems(message: ModelMessage, assistantToolCalls?: ModelToolCall[]): OpenAIResponsesInputItem[] {
    if (message.role === "tool") {
      if (!message.toolCallId) {
        throw new Error("Tool message is missing toolCallId for OpenAI Responses function_call_output continuation.");
      }

      return [
        {
          type: "function_call_output",
          call_id: message.toolCallId,
          output: message.content,
        },
      ];
    }

    if (message.role === "assistant") {
      const toolCalls = assistantToolCalls ?? [];
      if (toolCalls.length > 0) {
        const items: OpenAIResponsesInputItem[] = [];

        if (message.content.length > 0) {
          items.push({
            role: "assistant",
            content: message.content,
          });
        }

        items.push(
          ...toolCalls.map<OpenAIResponsesInputItem>((toolCall) => ({
            type: "function_call",
            call_id: toolCall.id,
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.input),
          })),
        );

        return items;
      }
    }

    return [
      {
        role: message.role,
        content: message.content,
      },
    ];
  }

  private toResponsesTool(tool: ToolDefinition): OpenAIResponsesTool {
    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? {
        type: "object",
        additionalProperties: true,
      },
      strict: tool.strict,
    };
  }

  private extractResponse(body: OpenAIResponsesApiResponse): ExtractedCompatibilityResponse {
    const nativeToolCalls = body.output?.flatMap((item) => extractNativeToolCall(item)) ?? [];
    const directOutputText = normalizeTextValue(body.output_text);
    const outputParts = body.output?.flatMap((item) => extractOutputItemText(item)) ?? [];

    if (directOutputText || outputParts.length > 0 || nativeToolCalls.length > 0) {
      return {
        content: directOutputText || outputParts.join(""),
        toolCalls: nativeToolCalls,
        finishReason: nativeToolCalls.length > 0 ? "tool_calls" : "stop",
        compatibility: {
          status: directOutputText ? "compatible" : "native",
          path: directOutputText ? "responses_output_text" : "responses_output",
        },
      };
    }

    const choiceParts = body.choices?.flatMap((choice) => extractChoiceText(choice)) ?? [];
    const choiceToolCalls = body.choices?.flatMap((choice) => extractChoiceToolCalls(choice)) ?? [];
    if (choiceParts.length > 0 || choiceToolCalls.length > 0) {
      return {
        content: choiceParts.join(""),
        toolCalls: choiceToolCalls,
        finishReason: choiceToolCalls.length > 0 ? "tool_calls" : "stop",
        compatibility: {
          status: "compatible",
          path: "chat_completions_choices",
        },
      };
    }

    if (body.error?.message) {
      return {
        content: "",
        toolCalls: [],
        finishReason: "error",
        errorMessage: body.error.message,
      };
    }

    return {
      content: "",
      toolCalls: [],
      finishReason: "stop",
    };
  }
}

function extractOutputItemText(item: NonNullable<OpenAIResponsesApiResponse["output"]>[number]): string[] {
  const textParts: string[] = [];
  const directText = normalizeTextValue(item.text);

  if (item.type === "output_text" && directText) {
    textParts.push(directText);
  }

  for (const content of item.content ?? []) {
    if (content.type && content.type !== "output_text" && content.type !== "text") {
      continue;
    }

    const text = normalizeTextValue(content.text);
    if (text) {
      textParts.push(text);
    }
  }

  if (textParts.length > 0) {
    return textParts;
  }

  return directText ? [directText] : [];
}

function extractChoiceText(choice: NonNullable<OpenAIResponsesApiResponse["choices"]>[number]): string[] {
  if (typeof choice.message?.content === "string") {
    return choice.message.content ? [choice.message.content] : [];
  }

  if (Array.isArray(choice.message?.content)) {
    return choice.message.content.flatMap((part) => {
      if (part.type && part.type !== "output_text" && part.type !== "text") {
        return [];
      }

      const text = normalizeTextValue(part.text);
      return text ? [text] : [];
    });
  }

  const directText = normalizeTextValue(choice.text);
  return directText ? [directText] : [];
}

function extractNativeToolCall(
  item: NonNullable<OpenAIResponsesApiResponse["output"]>[number],
): ModelToolCall[] {
  if (item.type !== "function_call") {
    return [];
  }

  const id = typeof item.call_id === "string" && item.call_id.length > 0 ? item.call_id : item.id;
  if (!id || !item.name) {
    return [];
  }

  return [
    {
      id,
      name: item.name,
      input: parseToolArguments(item.arguments, item.name),
    },
  ];
}

function extractChoiceToolCalls(
  choice: NonNullable<OpenAIResponsesApiResponse["choices"]>[number],
): ModelToolCall[] {
  return (
    choice.message?.tool_calls?.flatMap((toolCall) => {
      const id = toolCall.id;
      const name = toolCall.function?.name;

      if (!id || !name) {
        return [];
      }

      return [
        {
          id,
          name,
          input: parseToolArguments(toolCall.function?.arguments, name),
        },
      ];
    }) ?? []
  );
}

function parseToolArguments(argumentsText: string | undefined, toolName: string): Record<string, unknown> {
  if (!argumentsText?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(argumentsText) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(
      `OpenAI-compatible provider returned invalid tool arguments for ${toolName}: ${error instanceof Error ? error.message : "unknown parse failure"}`,
    );
  }

  throw new Error(`OpenAI-compatible provider returned non-object tool arguments for ${toolName}.`);
}

function degradeCompatibility(
  compatibility: ProviderCompatibility | undefined,
  note: string,
): ProviderCompatibility {
  return {
    status: "degraded",
    path: compatibility?.path ?? "responses_output",
    notes: [...(compatibility?.notes ?? []), note],
  };
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      value?: unknown;
      content?: unknown;
    };

    if (typeof candidate.value === "string") {
      return candidate.value;
    }

    if (typeof candidate.content === "string") {
      return candidate.content;
    }
  }

  return "";
}

function consumeSseBuffer(buffer: string): { events: string[]; remainder: string } {
  const chunks = buffer.split(/\n\n/);
  const remainder = chunks.pop() ?? "";

  return {
    events: chunks,
    remainder,
  };
}

function extractUpdateFromSseEvent(chunk: string): { text?: string; toolCall?: ModelToolCall } {
  const dataLines = chunk
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length));

  if (dataLines.length === 0) {
    return {};
  }

  const payload = dataLines.join("\n");
  if (payload === "[DONE]") {
    return {};
  }

  try {
    const parsed = JSON.parse(payload) as {
      type?: string;
      delta?: string;
      text?: string;
      item?: {
        type?: string;
        id?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
      };
    };

    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      return {
        text: parsed.delta,
      };
    }

    if (parsed.type === "response.output_text.done" && typeof parsed.text === "string") {
      return {};
    }

    if (parsed.type === "response.output_item.done" && parsed.item?.type === "function_call") {
      const id =
        typeof parsed.item.call_id === "string" && parsed.item.call_id.length > 0
          ? parsed.item.call_id
          : parsed.item.id;

      if (!id || !parsed.item.name) {
        return {};
      }

      return {
        toolCall: {
          id,
          name: parsed.item.name,
          input: parseToolArguments(parsed.item.arguments, parsed.item.name),
        },
      };
    }
  } catch {
    return {};
  }

  return {};
}
