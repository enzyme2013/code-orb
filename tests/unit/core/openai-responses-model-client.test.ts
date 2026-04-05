import { describe, expect, it, vi } from "vitest";

import { OpenAIResponsesModelClient } from "@code-orb/core";

describe("OpenAIResponsesModelClient", () => {
  it("normalizes a responses API payload into the shared model response shape", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_123",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "hello from provider",
              },
            ],
          },
        ],
        usage: {
          input_tokens: 11,
          output_tokens: 7,
          total_tokens: 18,
        },
      }),
    } as Response);

    const client = new OpenAIResponsesModelClient({
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.com/v1",
      fetchImpl,
    });

    const response = await client.complete({
      sessionId: "ses_1",
      turnId: "turn_1",
      profile: "default",
      messages: [
        {
          role: "user",
          content: "say hello",
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response.provider).toBe("openai");
    expect(response.model).toBe("gpt-test");
    expect(response.content).toBe("hello from provider");
    expect(response.usage?.totalTokens).toBe(18);
  });
});
