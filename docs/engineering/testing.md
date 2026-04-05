# Testing Strategy

## Goal

Testing should prove that the agent loop behaves correctly on realistic repository fixtures, not just that isolated helper functions compile.

## Default Framework

Use `Vitest` as the default test runner.

Why:

- fast feedback for a TypeScript-first workspace
- good support for ESM and modern Node projects
- strong enough unit, integration, and CLI-oriented test ergonomics without early Jest complexity

## Layers

- unit tests for pure logic and schema handling
- integration tests for tool execution and session flow
- end-to-end tests using fixture repositories

## Directory Shape

```text
tests/
  unit/         Pure contract and runtime-state tests
  integration/  Core runtime and tool-execution behavior
  e2e/          CLI-oriented end-to-end scenarios
  fixtures/     Small repositories used by integration and e2e tests
  helpers/      Shared test utilities and doubles
```

## Initial Priority

The first tests should focus on runtime contracts rather than rich product behavior.

Recommended starting set:

- schema contract tests
- session / turn / step state tests
- policy decision tests
- tool executor allow / confirm / deny flow tests

The first meaningful end-to-end tests should use fixture repositories instead of large real-world repositories.

## Fixture Repositories

`tests/fixtures/` should contain small repositories that simulate realistic tasks:

- simple TypeScript app
- failing test repair case
- documentation edit case
- safety policy edge case

## Reporting

Tests should assert both behavior and artifacts when possible:

- changed files
- final report shape
- event stream expectations
- safety decisions

## Event Expectation

Because structured events are runtime infrastructure, tests should assert against emitted events whenever practical instead of only checking final string output.
