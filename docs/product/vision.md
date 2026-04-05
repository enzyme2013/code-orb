# Vision

## Problem

Most coding agents are either impressive demos with weak engineering boundaries, or useful tools with architecture that is hard to extend. Code Orb is intended to be useful on real local repositories while still being structured for long-term evolution.

## Product Direction

Code Orb starts as a local CLI coding agent and later grows into a desktop-capable product without rewriting the core runtime. The CLI is the proving ground for task execution, tool safety, session handling, and verification loops.

## Primary User

The first user is a technical developer working on a local repository who wants a coding agent that can inspect code, plan changes, edit files, run verification commands, and report work clearly.

## Product Principles

- CLI first: prove the core loop before adding richer shells.
- Local repository first: optimize for working with code already on disk.
- Observable by default: users should understand what the agent looked at and changed.
- Safe by default: high-risk operations need clear policy and auditability.
- Extensible by design: app shells can change, but core contracts should stay stable.

## Non-Goals For Early Versions

- remote autonomous cloud execution
- generalized multi-agent orchestration
- full IDE integration
- complex plugin marketplaces
- distributed task scheduling

## Desktop Relation

The future desktop product should reuse the same core packages, session model, and tool contracts. Desktop is a new shell around the same core engine, not a separate implementation.
