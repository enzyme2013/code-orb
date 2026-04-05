# Testing Strategy

## Goal

Testing should prove that the agent loop behaves correctly on realistic repository fixtures, not just that isolated helper functions compile.

## Layers

- unit tests for pure logic and schema handling
- integration tests for tool execution and session flow
- end-to-end tests using fixture repositories

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
