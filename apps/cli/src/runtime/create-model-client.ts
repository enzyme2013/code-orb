import { EchoModelClient, OpenAIResponsesModelClient, type ModelClient } from "@code-orb/core";

export function createModelClientFromEnv(env: NodeJS.ProcessEnv): ModelClient {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL;

  if (apiKey && model) {
    return new OpenAIResponsesModelClient({
      apiKey,
      model,
      baseUrl: env.OPENAI_BASE_URL,
    });
  }

  return new EchoModelClient();
}
