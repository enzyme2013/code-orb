# Tests

Tests should grow around realistic task loops and fixture repositories, not only isolated helper functions.

## Runner

The default test runner is `Vitest`.

## Layout

```text
tests/
  unit/
  integration/
  e2e/
  fixtures/
  helpers/
```

## Current Focus

The first test slice should validate contracts and runtime boundaries:

- schema shapes
- session / turn / step modeling
- policy decision flow
- tool execution flow
