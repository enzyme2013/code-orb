# Phase 1: Runtime Contracts

## Purpose

Turn the current architecture intent into explicit runtime contracts before the implementation loop expands.

This phase is part of `0.1.0`, not a separate release.

## Scope

- define logical layering and dependency direction
- define `Session`, `Turn`, and `Step` semantics
- define the agent engine vs tool executor split
- define the minimum policy and permission model
- define the minimum event catalog
- define normalized tool execution and model interaction shapes
- define the `orb run` command surface at a contract level

## Deliverables

- architecture docs updated to reflect the agreed layer model
- execution model docs updated with runtime object semantics
- event, tool, and policy contracts clarified in docs and schemas
- roadmap updated to reflect the phased 0.1.0 approach

## Out Of Scope

- full end-to-end CLI loop
- advanced provider routing
- dynamic skill discovery
- subagent runtime
- desktop shell

## Exit Criteria

- a contributor can explain the shell/core/adapter split from the docs alone
- session, turn, and step are no longer ambiguous terms
- tool, policy, and event boundaries are explicit enough to guide implementation
- future multi-provider support is not blocked by the V0.1 abstractions
