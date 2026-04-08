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

## Generated Edit Rules

Assistant-produced repository edits do not bypass policy just because the model described them conversationally first.

For the `0.6.0` baseline:

- generated create is a mutating action
- generated rewrite is a mutating action
- targeted replacement is a mutating action
- each of these must still route through runtime policy evaluation and approval handling

The important rule is that conversational inference is not itself an approval path.

If the runtime translates assistant output into a repository mutation, that mutation must still be attributable, reviewable, and enforceable through the same safety model as other edit tools.

## Provider And Fallback Rules

Provider transport behavior does not create a second safety path.

In particular:

- provider-native tool calling does not bypass policy evaluation
- continuation fallback must not silently reclassify a mutating action as safe
- adapter-owned retries or transport recovery must preserve the same approval and audit semantics as the original tool request

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
- `Tool Orchestrator` routes the request through policy evaluation and approval handling
- `Tool Executor` enforces the decision for one concrete tool call
- `Shell` renders a confirmation prompt when needed
- `Core Runtime` records the decision as an event

The `Provider Adapter` is not allowed to redefine mutating versus read-only policy. It may retry transport, normalize provider behavior, or fall back between continuation strategies, but it must not become a side channel that bypasses recorded policy decisions.

## Future Questions

Topics intentionally deferred for later ADRs:

- sandbox strategy
- network policy details
- credential handling
- desktop approval UX
