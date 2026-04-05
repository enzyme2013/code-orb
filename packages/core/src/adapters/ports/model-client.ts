import type { ModelRequest, ModelResponse, ProviderCapabilities } from "@code-orb/schemas";

export interface ModelClient {
  readonly provider: string;
  readonly capabilities: ProviderCapabilities;

  complete(request: ModelRequest): Promise<ModelResponse>;
}
