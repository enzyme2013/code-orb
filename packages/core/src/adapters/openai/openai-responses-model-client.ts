import type { ModelMessage, ModelRequest, ModelResponse, ProviderCapabilities } from "@code-orb/schemas";

import type { ModelClient } from "../ports/model-client.js";

interface OpenAIResponsesClientOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIResponsesApiResponse {
  output_text?: string;
  id?: string;
  output?: Array<{
    type?: string;
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

export class OpenAIResponsesModelClient implements ModelClient {
  readonly provider = "openai";
  readonly capabilities: ProviderCapabilities = {
    toolCalling: false,
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
    const requestBody = {
      model: this.options.model,
      input: request.messages.map((message) => this.toInputText(message)),
      max_output_tokens: request.maxOutputTokens,
      temperature: request.temperature,
    };

    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI responses request failed (${response.status}): ${message}`);
    }

    const body = (await response.json()) as OpenAIResponsesApiResponse;
    let content = this.extractText(body);

    if (!content.trim()) {
      content = await this.completeViaStreamingFallback(requestBody);
    }

    if (!content.trim()) {
      throw new Error(
        `OpenAI-compatible provider returned no assistant content for model ${this.options.model}.`,
      );
    }

    return {
      provider: this.provider,
      model: this.options.model,
      profile: request.profile,
      content,
      finishReason: "stop",
      usage: {
        inputTokens: body.usage?.input_tokens,
        outputTokens: body.usage?.output_tokens,
        totalTokens: body.usage?.total_tokens,
      },
      raw: {
        id: body.id,
      },
    };
  }

  private async completeViaStreamingFallback(requestBody: {
    model: string;
    input: Array<{ role: string; content: string }>;
    max_output_tokens?: number;
    temperature?: number;
  }): Promise<string> {
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
      return "";
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let aggregated = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = consumeSseBuffer(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        const text = extractTextFromSseEvent(event);
        if (text) {
          aggregated += text;
        }
      }
    }

    if (buffer.trim()) {
      const parsed = consumeSseBuffer(`${buffer}\n\n`);
      for (const event of parsed.events) {
        const text = extractTextFromSseEvent(event);
        if (text) {
          aggregated += text;
        }
      }
    }

    return aggregated;
  }

  private toInputText(message: ModelMessage): { role: string; content: string } {
    return {
      role: message.role,
      content: message.content,
    };
  }

  private extractText(body: OpenAIResponsesApiResponse): string {
    const directOutputText = normalizeTextValue(body.output_text);
    if (directOutputText) {
      return directOutputText;
    }

    const outputParts = body.output?.flatMap((item) => extractOutputItemText(item)) ?? [];
    if (outputParts.length > 0) {
      return outputParts.join("");
    }

    const choiceParts = body.choices?.flatMap((choice) => extractChoiceText(choice)) ?? [];
    if (choiceParts.length > 0) {
      return choiceParts.join("");
    }

    if (body.error?.message) {
      return body.error.message;
    }

    return "";
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

function extractTextFromSseEvent(chunk: string): string {
  const dataLines = chunk
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length));

  if (dataLines.length === 0) {
    return "";
  }

  const payload = dataLines.join("\n");
  if (payload === "[DONE]") {
    return "";
  }

  try {
    const parsed = JSON.parse(payload) as {
      type?: string;
      delta?: string;
      text?: string;
    };

    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      return parsed.delta;
    }

    if (parsed.type === "response.output_text.done" && typeof parsed.text === "string") {
      return "";
    }
  } catch {
    return "";
  }

  return "";
}
