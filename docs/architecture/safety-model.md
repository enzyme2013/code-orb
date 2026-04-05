# Safety Model

## Goal

The agent must be useful without becoming careless. Safety in Code Orb means making risky actions explicit, enforceable, and reviewable.

## Initial Policy Shape

Commands and actions should fall into three buckets:

- allow: low-risk read-only actions
- confirm: side-effecting actions that may be legitimate but require user intent
- deny: clearly unsafe or out-of-policy actions

## Command Examples

Initial examples for planning purposes:

- allow: file reads, text search, safe repository inspection
- confirm: file writes, package installs, test commands with side effects, git commits
- deny: destructive resets, deleting unrelated files, opaque network actions by default

The exact allowlist and denylist should be implementation-backed later, but the categories should remain visible to the user.

## Filesystem Rules

- operations should stay within the target repository unless explicitly allowed
- write operations should be attributable to a task and session
- patch application is preferred over opaque mutation

## Auditability

Every significant action should be recoverable from logs or event artifacts:

- what action was requested
- what policy was applied
- what actually ran
- what changed

## Future Questions

Topics intentionally deferred for later ADRs:

- sandbox strategy
- network policy details
- credential handling
- desktop approval UX
