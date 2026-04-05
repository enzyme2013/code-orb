# Tool Contracts

## Purpose

Tool contracts define how the agent asks for capability and how the runtime returns results. They must be explicit enough to support both implementation and testing.

## Logical Shape

Every tool should define:

- `name`
- `description`
- `riskLevel`
- input schema
- output schema
- error shape

## Contract Rules

- tool names should be verb-oriented and unambiguous
- input and output should be serializable
- outputs should separate successful data from execution metadata
- errors should include a machine-readable code and human-readable summary

## Example Logical Contracts

`read_file`

- input: path
- output: content, encoding, truncated

`run_command`

- input: command, working directory, timeout, approval context
- output: exit code, stdout, stderr, duration, policy decision

## Ownership

- schemas live in `packages/schemas`
- runtime implementations live in `packages/core`
- tests should assert contract behavior rather than private implementation details
