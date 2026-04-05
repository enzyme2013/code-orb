# Prompts

Prompt assets are first-class project artifacts. Keep prompt templates versioned and scoped by responsibility rather than embedding all prompt text in source files.

## Scope

The minimum prompt baseline for `0.2.0` should cover:

- `system/`
- `planner/`
- `executor/`
- `reviewer/`

These prompts do not need a complex framework yet. They do need:

- clear responsibility boundaries
- repository versioning
- predictable file locations
- room for simple variable injection by the runtime

## Current Convention

Prompt files should stay narrow and role-specific:

- `system/` defines global behavior and safety boundaries
- `planner/` defines how the agent interprets the task and builds a plan
- `executor/` defines how the agent uses tools and updates state while working
- `reviewer/` defines how the agent summarizes results, validations, and risks

The first `0.2.0` benchmark path should use these assets instead of relying only on prompt strings hidden in code.
