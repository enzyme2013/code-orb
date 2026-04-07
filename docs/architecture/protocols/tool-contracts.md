# Tool Contracts

## Purpose

Tool contracts define how the agent asks for capability and how the runtime returns results. They must be explicit enough to support both implementation and testing.

## Logical Shape

Every tool should define:

- `name`
- `description`
- `kind`
- `mutability`
- `approvalRequirement`
- input shape
- output shape
- error shape
- execution metadata expectations
- timeout or interrupt behavior when applicable

## Contract Rules

- tool names should be verb-oriented and unambiguous
- registered tool definitions should be available through a runtime-owned boundary
- input and output should be serializable
- outputs should separate successful data from execution metadata
- errors should include a machine-readable code and human-readable summary
- unknown-tool behavior should be explicit rather than silently ignored
- the contract should distinguish tool registration from tool invocation

## Registration Versus Invocation

`0.6.0` requires a clearer distinction between two different contract surfaces:

- registration contract
  - what a tool is, what it is called, what mutability it has, what approval path it expects, and what execution semantics it declares
- invocation contract
  - one concrete call request, its input payload, policy outcome, execution result, metadata, and any error

This distinction matters even when the runtime still ships only built-in tools.

It keeps the tool system extensible without turning the current implementation into a plugin platform prematurely.

## Example Logical Contracts

`read_file`

- registration: read-only context tool with automatic approval
- input: path
- output: content, encoding, truncated metadata when applicable

`run_command`

- registration: mutating execution tool with declared approval behavior and possible timeout semantics
- input: command, working directory, timeout, approval context
- output: exit code, stdout, stderr, duration, policy and execution metadata

## Generated Edit Relationship

Assistant-produced edit execution is not only a conversational pattern.

When the runtime turns assistant output into repository mutation, the contract should remain auditable:

- the edit mode should be explicit:
  - generated create
  - generated rewrite
  - targeted replacement
- the invoked tool path should still expose input, output, metadata, and error behavior
- reporting and events should not require consumers to infer the edit mode only from assistant prose

## Ownership

- schemas live in `packages/schemas`
- runtime implementations live in `packages/core`
- tests should assert contract behavior rather than private implementation details
