import { describe, expect, it, vi } from "vitest";

import { OpenAIResponsesModelClient } from "@code-orb/core";
import type { ToolDefinition } from "@code-orb/schemas";

const CUSTOM_ECHO_TOOL: ToolDefinition = {
  name: "custom_echo",
  description: "Echo the provided value.",
  kind: "context",
  mutability: "read_only",
  approvalRequirement: "auto",
  inputSchema: {
    type: "object",
    properties: {
      value: {
        type: "string",
      },
    },
    required: ["value"],
    additionalProperties: false,
  },
};

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
    expect(client.capabilities.toolCalling).toBe(true);
  });

  it("sends runtime-owned tool definitions to the responses API when tools are available", async () => {
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
      }),
    } as Response);

    const client = new OpenAIResponsesModelClient({
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.com/v1",
      fetchImpl,
    });

    await client.complete({
      sessionId: "ses_1",
      turnId: "turn_1",
      profile: "default",
      messages: [
        {
          role: "user",
          content: "say hello",
        },
      ],
      tools: [CUSTOM_ECHO_TOOL],
    });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      tools?: Array<{
        type?: string;
        name?: string;
        parameters?: Record<string, unknown>;
      }>;
      tool_choice?: string;
    };

    expect(body.tools).toEqual([
      {
        type: "function",
        name: "custom_echo",
        description: "Echo the provided value.",
        parameters: CUSTOM_ECHO_TOOL.inputSchema,
      },
    ]);
    expect(body.tool_choice).toBe("auto");
  });

  it("uses previous_response_id and function_call_output items for tool continuation", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_456",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "tool result summarized",
              },
            ],
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

    await client.complete({
      sessionId: "ses_1",
      turnId: "turn_1",
      profile: "default",
      messages: [
        {
          role: "user",
          content: "call the tool",
        },
        {
          role: "assistant",
          content: "",
        },
        {
          role: "tool",
          name: "custom_echo",
          toolCallId: "call_1",
          content: '{"echoed":"hello"}',
        },
      ],
      continuation: {
        previousResponseId: "resp_previous",
        continuationMessageIndex: 2,
        assistantToolCalls: [
          {
            id: "call_1",
            name: "custom_echo",
            input: {
              value: "hello",
            },
          },
        ],
      },
    });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      previous_response_id?: string;
      input?: unknown[];
    };

    expect(body.previous_response_id).toBe("resp_previous");
    expect(body.input).toEqual([
      {
        type: "function_call_output",
        call_id: "call_1",
        output: '{"echoed":"hello"}',
      },
    ]);
  });

  it("falls back to a full replay request when continuation fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '{"error":{"message":"Upstream request failed","type":"upstream_error"}}',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resp_replayed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "tool result summarized",
                },
              ],
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
          content: "call the tool",
        },
        {
          role: "assistant",
          content: "",
        },
        {
          role: "tool",
          name: "custom_echo",
          toolCallId: "call_1",
          content: '{"echoed":"hello"}',
        },
      ],
      continuation: {
        previousResponseId: "resp_previous",
        continuationMessageIndex: 2,
        assistantToolCalls: [
          {
            id: "call_1",
            name: "custom_echo",
            input: {
              value: "hello",
            },
          },
        ],
      },
    });

    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      previous_response_id?: string;
    };
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as {
      previous_response_id?: string;
      input?: unknown[];
    };

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(firstBody.previous_response_id).toBe("resp_previous");
    expect(secondBody.previous_response_id).toBeUndefined();
    expect(secondBody.input).toEqual([
      {
        role: "user",
        content: "call the tool",
      },
      {
        type: "function_call",
        call_id: "call_1",
        name: "custom_echo",
        arguments: '{"value":"hello"}',
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output: '{"echoed":"hello"}',
      },
    ]);
    expect(response.content).toBe("tool result summarized");
    expect(response.compatibility).toEqual({
      status: "degraded",
      path: "responses_output",
      notes: ["Recovered by retrying without previous_response_id after continuation failed or returned no usable content."],
    });
  });

  it("normalizes native responses function calls into shared model tool calls", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_tool_call",
        output: [
          {
            type: "function_call",
            id: "fc_1",
            call_id: "call_1",
            name: "custom_echo",
            arguments: '{"value":"hello"}',
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
          content: "call the tool",
        },
      ],
      tools: [CUSTOM_ECHO_TOOL],
    });

    expect(response.content).toBe("");
    expect(response.finishReason).toBe("tool_calls");
    expect(response.toolCalls).toEqual([
      {
        id: "call_1",
        name: "custom_echo",
        input: {
          value: "hello",
        },
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("normalizes chat-completions style tool calls from compatible gateways", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_choice_tool_call",
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_choice_1",
                  function: {
                    name: "custom_echo",
                    arguments: '{"value":"hello"}',
                  },
                },
              ],
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
          content: "call the tool",
        },
      ],
      tools: [CUSTOM_ECHO_TOOL],
    });

    expect(response.finishReason).toBe("tool_calls");
    expect(response.compatibility).toEqual({
      status: "compatible",
      path: "chat_completions_choices",
    });
    expect(response.toolCalls).toEqual([
      {
        id: "call_choice_1",
        name: "custom_echo",
        input: {
          value: "hello",
        },
      },
    ]);
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
      "OpenAI-compatible provider returned no assistant content or tool calls for model gpt-test after non-streaming normalization and streaming fallback.",
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

  it("recovers tool calls from streaming fallback when the non-streaming payload is empty", async () => {
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
            "event: response.output_item.added",
            'data: {"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","status":"in_progress","arguments":"","call_id":"call_1","name":"custom_echo"}}',
            "",
            "event: response.function_call_arguments.done",
            'data: {"type":"response.function_call_arguments.done","arguments":"{\\"value\\":\\"hello\\"}","item_id":"fc_1","output_index":0}',
            "",
            "event: response.output_item.done",
            'data: {"type":"response.output_item.done","item":{"id":"fc_1","type":"function_call","status":"completed","arguments":"{\\"value\\":\\"hello\\"}","call_id":"call_1","name":"custom_echo"}}',
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
          content: "call the tool",
        },
      ],
      tools: [CUSTOM_ECHO_TOOL],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.content).toBe("");
    expect(response.finishReason).toBe("tool_calls");
    expect(response.toolCalls).toEqual([
      {
        id: "call_1",
        name: "custom_echo",
        input: {
          value: "hello",
        },
      },
    ]);
    expect(response.compatibility).toEqual({
      status: "degraded",
      path: "responses_streaming_fallback",
      notes: ["Recovered tool calls through streaming fallback after an empty non-streaming response."],
    });
  });
});
