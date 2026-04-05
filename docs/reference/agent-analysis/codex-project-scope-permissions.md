# Codex Project-Scope Permissions

## Purpose

This note records what appears to be stored for Codex at the project scope, based on local file inspection.

It intentionally ignores user-scope behavior unless it is necessary to explain the project-level boundary.

## Short Answer

For the current local Codex setup, the clearest project-scope permission signal is:

- per-project `trust_level` entries in `~/.codex/config.toml`

By contrast:

- persisted `prefix_rule` approvals appear to be stored globally in `~/.codex/rules/default.rules`
- session-level approval and sandbox context appears in `~/.codex/sessions/...jsonl`, but those files look like logs rather than the source of truth for project policy

## Observed Files

### `~/.codex/config.toml`

This file contains project-keyed entries like:

```toml
[projects."/path/to/project"]
trust_level = "trusted"
```

For this repository, an entry exists for the local `code-orb` project and marks it as trusted.

Interpretation:

- Codex appears to maintain project-specific trust state here.
- This is the most direct project-scope permission-related setting observed in plain-text config.

### `~/.codex/rules/default.rules`

This file contains persisted `prefix_rule(..., decision="allow")` entries.

Interpretation:

- the file name and content suggest these are default or global allow rules
- no project-specific namespacing was observed in this file during inspection

Practical consequence:

- if you only care about project scope, this file is relevant context but not the main place to look

### `~/.codex/sessions/...jsonl`

Session logs include values such as:

- `approval_policy`
- `sandbox_policy`

Interpretation:

- these files capture the runtime context of a session
- they are useful for inspection and debugging
- they do not appear to be the canonical storage for project-level permission policy

## Working Model

The current best working model is:

1. project scope:
   `~/.codex/config.toml`
   stores whether a repository is trusted
2. global reusable approvals:
   `~/.codex/rules/default.rules`
   stores persisted prefix-based allow rules
3. per-session runtime context:
   `~/.codex/sessions/...jsonl`
   records how a given session ran

## What This Means For Code Orb

If Code Orb wants to model Codex-like behavior, the project-scope concept should likely be treated separately from reusable approval rules.

Useful separation:

- project trust
- reusable command approval rules
- per-session runtime permission context

This separation is cleaner than treating all permissions as one flat blob.

## Limits Of This Note

This note is based on inspection of visible local files, not an internal Codex implementation spec.

Not verified here:

- whether additional project-scoped permission state exists in SQLite state files
- whether future Codex versions will move these fields
- whether some approvals are cached in memory or another opaque store

## Recommendation

For project-scope modeling inside Code Orb, start with a narrow concept:

- `project trust level`

Do not overload that concept with:

- global command allow rules
- per-session sandbox decisions

Those should remain separate concerns in the architecture.
