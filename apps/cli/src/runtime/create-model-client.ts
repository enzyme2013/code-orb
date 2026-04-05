import { EchoModelClient, OpenAIResponsesModelClient, type ModelClient } from "@code-orb/core";

export class ModelClientConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelClientConfigurationError";
  }
}

export function createModelClientFromEnv(env: NodeJS.ProcessEnv): ModelClient {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL;
  const baseUrl = env.OPENAI_BASE_URL;

  if ((apiKey && !model) || (!apiKey && model)) {
    throw new ModelClientConfigurationError(
      "OPENAI_API_KEY and OPENAI_MODEL must be set together to enable the real provider.",
    );
  }

  if (baseUrl && !apiKey && !model) {
    throw new ModelClientConfigurationError(
      "OPENAI_BASE_URL was provided without OPENAI_API_KEY and OPENAI_MODEL.",
    );
  }

  if (apiKey && model) {
    return new OpenAIResponsesModelClient({
      apiKey,
      model,
      baseUrl,
    });
  }

  return new EchoModelClient();
}
