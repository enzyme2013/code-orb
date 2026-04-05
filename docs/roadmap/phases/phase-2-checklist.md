# Phase 2 Checklist

## Purpose

This checklist turns Phase 2 into an ordered execution plan and a review baseline.

Unlike Phase 1, this phase is not mainly about contracts. It is about proving one real prompt-to-report loop on a local repository fixture.

## Ordered Todo List

Follow this order unless there is a strong reason to change it:

1. wire the CLI composition root so `orb run` can invoke the core runtime
2. add a basic terminal event renderer driven by runtime events
3. implement one real `ModelClient` path for a single provider
4. implement the first read-only repository tools:
   `list_files`, `read_file`, `search_text`
5. implement the first mutating and verification tools:
   `apply_patch`, `run_command`
6. route mutating tool execution through the minimum safety gate
7. add one or more fixture repositories for end-to-end verification
8. add e2e tests for one believable prompt -> inspect -> edit -> verify -> report task
9. tighten the final report so it summarizes changes, validations, and remaining risks

## CLI And Composition

- [x] `orb run` no longer stops at command validation and can invoke the core runtime
- [x] the CLI composition root wires together a session runner, agent engine, event sink, model client, policy engine, and tool executor
- [x] the CLI still keeps execution semantics out of the shell layer

## Event-Driven Rendering

- [x] CLI progress output is driven by runtime events
- [x] the final report is assembled from runtime results instead of ad hoc shell strings
- [x] event rendering remains compatible with a future non-CLI shell

## Model Access

- [x] one real provider-backed `ModelClient` exists
- [x] provider-specific transport stays behind the model client adapter boundary
- [x] the core runtime still depends on normalized model contracts rather than provider-specific response shapes

## Tools

- [x] `list_files` exists and works on the target repository
- [x] `read_file` exists and returns file content in the tool contract shape
- [x] `search_text` exists and supports repository text search
- [x] `apply_patch` or an equivalent controlled write path exists
- [x] `run_command` exists and returns standardized execution metadata

## Safety Gate

- [x] read-only repository tools can run without unnecessary prompts
- [x] mutating actions route through the minimum policy / approval flow
- [x] obviously unsafe actions still have a deny path

## End-To-End Proof

- [x] at least one fixture repository exists for a realistic Phase 2 task
- [x] at least one e2e scenario exercises prompt -> inspect -> edit -> verify -> report
- [x] the final result includes a believable summary of what changed and what was validated

## Scope Discipline

- [x] Phase 2 still avoids subagents, daemon mode, dynamic skills, and desktop UI
- [x] Phase 2 still avoids advanced provider routing as a required capability
- [x] the implementation remains small enough to keep the first loop understandable

## Exit Rule

Phase 2 is complete only when the first real local-repository loop works on a fixture repository and the checklist can be reviewed item by item without relying on unstated behavior.
