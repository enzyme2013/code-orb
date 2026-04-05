import { describe, expect, it } from "vitest";

import { OpenAIResponsesModelClient } from "@code-orb/core";

import { createModelClientFromEnv, ModelClientConfigurationError } from "../../../apps/cli/src/runtime/create-model-client";

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

  it("throws when only one required provider variable is set", () => {
    expect(() => createModelClientFromEnv({ OPENAI_API_KEY: "test-key" })).toThrow(ModelClientConfigurationError);
    expect(() => createModelClientFromEnv({ OPENAI_MODEL: "gpt-test" })).toThrow(
      "OPENAI_API_KEY and OPENAI_MODEL must be set together",
    );
  });

  it("throws when OPENAI_BASE_URL is provided without the required provider variables", () => {
    expect(() =>
      createModelClientFromEnv({
        OPENAI_BASE_URL: "https://example.com/v1",
      }),
    ).toThrow("OPENAI_BASE_URL was provided without OPENAI_API_KEY and OPENAI_MODEL.");
  });
});
