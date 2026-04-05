# V0 Scope

## Goal

Deliver a CLI coding agent that can complete a basic local-repository task loop end to end:

1. accept a natural-language request
2. inspect repository context
3. produce a short plan
4. apply code or doc changes
5. run verification commands
6. report outcomes and risks

## In Scope

- single local repository execution
- single-process CLI runtime
- repository inspection tools such as read file and search
- file editing and patch application
- shell command execution with a safety policy
- task summary with validation results
- docs and contracts that make future extension predictable

## Out Of Scope

- multi-agent execution
- background daemon mode
- desktop UI
- remote repository execution
- hosted collaboration features
- general plugin ecosystem
- persistent long-term memory beyond the current session model

## Exit Criteria For 0.1.0

- a contributor can run the CLI on a fixture repository
- the agent can read, search, edit, and verify within that repository
- the agent produces a structured final report
- the core package boundaries are stable enough to support a second app shell later
- the safety model is documented and reflected in the implementation plan

## Quality Bar

V0 does not need to be feature rich, but it does need to be structurally honest. Any feature shipped in V0 should already respect the intended package boundaries and documentation model.
