# Safety Model

## Goal

The agent must be useful without becoming careless. Safety in Code Orb means making risky actions explicit, enforceable, and reviewable.

## Terms

Use these terms precisely:

- `policy`: the rules used to evaluate an action
- `permission decision`: the result of that evaluation
- `approval response`: the user's response when confirmation is required

In other words:

- policy is the rule system
- permission is the decision outcome for one request
- approval response is the user's answer to a confirmation request

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

## V0.1 Minimum Model

V0.1 does not need a large permission system. It does need a clear decision point.

Minimum shape:

```text
Tool Request
  -> Policy Evaluation
  -> allow | confirm | deny
  -> optional Approval Response
```

This gives Code Orb a consistent trust model without introducing a complex policy DSL too early.

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

## Boundary

Policy evaluation should be a distinct runtime concern. It should not be hidden inside individual tool implementations or CLI prompts.

Recommended separation:

- `Policy Engine` evaluates the request
- `Tool Executor` enforces the decision
- `Shell` renders a confirmation prompt when needed
- `Core Runtime` records the decision as an event

## Future Questions

Topics intentionally deferred for later ADRs:

- sandbox strategy
- network policy details
- credential handling
- desktop approval UX
