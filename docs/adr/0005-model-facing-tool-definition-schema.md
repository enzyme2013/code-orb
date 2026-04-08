# ADR 0005: Model-Facing Tool Definition Schema For Provider Tool Calling

- Status: Accepted
- Date: 2026-04-08

## Context

`0.7.0` introduces an explicit turn loop that can continue after tool execution when a provider supports model-native tool calling.

The runtime already had:

- runtime-owned tool registration
- normalized `ModelToolCall` output in the shared model contract
- a loop capable of re-entering model state after tool execution

But one contract gap remained:

- `ToolDefinition` did not carry a model-facing input schema, so provider adapters could expose tool names but not reliable parameter structure

Without a schema-backed input contract, model-native tool calling would either:

- depend on adapter-local hardcoded per-tool parameter shapes
- expose ambiguous tools to the model
- or silently weaken the runtime-owned tool boundary that `0.6.0` established

At the same time, OpenAI Responses tool continuation is stateful:

- the follow-up request should reference the prior response id
- tool outputs should be sent as explicit `function_call_output` items

That continuation behavior needs to stay adapter-owned, but it also depends on the runtime preserving the prior provider response id in assistant message metadata.

## Decision

For `0.7.0`:

1. `ToolDefinition` carries an optional model-facing `inputSchema`
   - this schema is the provider-facing parameter contract for tool calling
   - runtime-owned registrations remain the source of truth
   - adapters may fall back to a permissive object schema only when a registration does not provide one
2. provider adapters map runtime tool definitions to provider-native tool descriptors
   - for OpenAI Responses, built-in tools are surfaced as `type: "function"` entries with `name`, `description`, and `parameters`
3. assistant messages may preserve adapter-owned continuation metadata
   - specifically, the OpenAI Responses adapter may reuse the prior response id when continuing after tool execution
   - tool outputs are represented in runtime messages as tool-role messages with `toolCallId`, and the adapter translates them to provider-native continuation input

## Consequences

### Positive

- preserves the runtime-owned tool boundary while enabling provider-native tool calling
- avoids adapter-local hardcoded tool parameter catalogs
- keeps provider continuation details adapter-owned instead of leaking them into the CLI shell
- gives future providers a clear model-facing contract to map from

### Negative

- expands the tool contract shape and therefore the schema surface that later providers must honor
- introduces provider-continuation metadata in assistant messages, which requires discipline to keep adapter-local details from spreading further

## Follow-Up

`0.7.0` follow-up work should:

- keep built-in tool registrations aligned with their declared input schemas
- document how provider adapters use model-facing tool schemas without turning them into CLI-owned artifacts
- keep model-native tool calling optional rather than making it a hard runtime dependency
