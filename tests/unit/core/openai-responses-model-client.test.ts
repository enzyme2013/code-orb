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
    expect(response.compatibility).toEqual({
      status: "native",
      path: "responses_output",
    });
    expect(response.usage?.totalTokens).toBe(18);
  });

  it("accepts a top-level output_text field from compatible responses APIs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_compat",
        output_text: "pong",
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
          content: "reply with pong",
        },
      ],
    });

    expect(response.content).toBe("pong");
    expect(response.compatibility).toEqual({
      status: "compatible",
      path: "responses_output_text",
    });
  });

  it("falls back to chat-completions style choices when a compatible gateway returns them", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_choices",
        choices: [
          {
            message: {
              content: "hello from choices",
            },
          },
        ],
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

    expect(response.content).toBe("hello from choices");
    expect(response.compatibility).toEqual({
      status: "compatible",
      path: "chat_completions_choices",
    });
  });

  it("throws a clear error when the provider returns an error payload", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_error",
        error: {
          message: "gateway rejected the request",
        },
      }),
    } as Response);

    const client = new OpenAIResponsesModelClient({
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.com/v1",
      fetchImpl,
    });

    await expect(
      client.complete({
        sessionId: "ses_1",
        turnId: "turn_1",
        profile: "default",
        messages: [
          {
            role: "user",
            content: "say hello",
          },
        ],
      }),
    ).rejects.toThrow(
      "OpenAI-compatible provider returned an error payload for model gpt-test: gateway rejected the request",
    );
  });

  it("throws a clear error when the provider returns no assistant content after fallback", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_empty",
        output: [],
      }),
    } as Response);

    const client = new OpenAIResponsesModelClient({
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.com/v1",
      fetchImpl,
    });

    await expect(
      client.complete({
        sessionId: "ses_1",
        turnId: "turn_1",
        profile: "default",
        messages: [
          {
            role: "user",
            content: "say hello",
          },
        ],
      }),
    ).rejects.toThrow(
      "OpenAI-compatible provider returned no assistant content for model gpt-test after non-streaming normalization and streaming fallback.",
    );
  });

  it("falls back to streaming responses when the non-streaming payload has no assistant content", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resp_empty",
          output: [],
        }),
      } as Response)
      .mockResolvedValueOnce(
        new Response(
          [
            "event: response.output_text.delta",
            'data: {"type":"response.output_text.delta","delta":"pong"}',
            "",
            "event: response.output_text.done",
            'data: {"type":"response.output_text.done","text":"pong"}',
            "",
          ].join("\n"),
          {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
            },
          },
        ),
      );

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
          content: "reply with pong",
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.content).toBe("pong");
    expect(response.compatibility).toEqual({
      status: "degraded",
      path: "responses_streaming_fallback",
      notes: ["Recovered assistant content through streaming fallback after an empty non-streaming response."],
    });
  });
});
