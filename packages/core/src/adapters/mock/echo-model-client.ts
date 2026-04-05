import type { ModelRequest, ModelResponse, ProviderCapabilities } from "@code-orb/schemas";

import type { ModelClient } from "../ports/model-client.js";

export class EchoModelClient implements ModelClient {
  readonly provider = "mock";
  readonly capabilities: ProviderCapabilities = {
    toolCalling: false,
    streaming: false,
    structuredOutput: false,
  };

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const userMessage = [...request.messages].reverse().find((message) => message.role === "user");
    const content = userMessage?.content.trim() || "No task provided.";

    return {
      provider: this.provider,
      model: "echo-model",
      profile: request.profile,
      content: `Planned task: ${content}`,
      finishReason: "stop",
    };
  }
}
