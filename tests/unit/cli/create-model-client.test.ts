import { describe, expect, it } from "vitest";

import { OpenAIResponsesModelClient } from "@code-orb/core";

import { createModelClientFromEnv } from "../../../apps/cli/src/runtime/create-model-client";

describe("createModelClientFromEnv", () => {
  it("returns the provider-backed client when env config is present", () => {
    const client = createModelClientFromEnv({
      OPENAI_API_KEY: "test-key",
      OPENAI_MODEL: "gpt-test",
      OPENAI_BASE_URL: "https://example.com/v1",
    });

    expect(client).toBeInstanceOf(OpenAIResponsesModelClient);
  });

  it("falls back to the echo client when env config is missing", () => {
    const client = createModelClientFromEnv({});

    expect(client.provider).toBe("mock");
  });
});
