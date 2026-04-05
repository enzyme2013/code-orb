import type { ModelMessage, ModelRequest, ModelResponse, ProviderCapabilities } from "@code-orb/schemas";

import type { ModelClient } from "../ports/model-client.js";

interface OpenAIResponsesClientOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIResponsesApiResponse {
  id?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
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
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        input: request.messages.map((message) => this.toInputText(message)),
        max_output_tokens: request.maxOutputTokens,
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI responses request failed (${response.status}): ${message}`);
    }

    const body = (await response.json()) as OpenAIResponsesApiResponse;
    const content = this.extractText(body);

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

  private toInputText(message: ModelMessage): { role: string; content: string } {
    return {
      role: message.role,
      content: message.content,
    };
  }

  private extractText(body: OpenAIResponsesApiResponse): string {
    const outputParts =
      body.output
        ?.flatMap((item) => item.content ?? [])
        .filter((content) => content.type === "output_text")
        .map((content) => content.text ?? "") ?? [];

    if (outputParts.length > 0) {
      return outputParts.join("");
    }

    if (body.error?.message) {
      return body.error.message;
    }

    return "";
  }
}
