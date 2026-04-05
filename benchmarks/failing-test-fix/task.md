# Failing Test Fix Task

## Goal

Repair a failing test in a small TypeScript repository without changing the intended behavior of the project.

The benchmark is meant to validate realistic coding-agent behavior on an existing codebase, not greenfield code generation.

## Expected Agent Behaviors

The agent should:

1. inspect repository context before editing
2. identify the failing test or failing verification output
3. locate the relevant implementation file or files
4. make the smallest reasonable fix
5. rerun verification
6. produce a clear final report

## Repository Shape

The benchmark repository should be small and controlled:

- TypeScript project
- roughly `5-15` source and test files total
- one primary failing behavior
- one fixed verification command
- no network access required
- no dependency installation required during normal benchmark execution

## Constraints

- prefer implementation changes over changing tests
- changing tests is only acceptable when the benchmark explicitly requires it
- changes should usually stay within `1-3` files
- avoid broad refactors that are not necessary to fix the failure

## Acceptance Criteria

The benchmark is successful when:

- the relevant failing test or verification command passes
- no obvious regression is introduced in the benchmark verification set
- the final report explains:
  - what failed
  - what was changed
  - what verification was run
  - any remaining risk or uncertainty

## Verification Command

Run the benchmark verification from `repo/`:

```bash
node verify.mjs
```

## Non-Goals

This benchmark is not intended to measure:

- UI generation
- multi-agent coordination
- large-scale refactoring
- long-running autonomous planning

## Why This Benchmark

This task is a better fit for `0.2.0` than greenfield generation tasks such as building a game from scratch because it stresses the abilities a local coding agent actually needs:

- repository understanding
- context gathering
- planning
- tool selection
- edit and verify loops
- trustworthy reporting
