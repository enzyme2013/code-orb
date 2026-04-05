# Code Orb Gap Analysis Against Claude Code Reference

## Purpose

This note compares the current `code-orb` project state with the Claude Code reference analysis already collected under `docs/reference/agent-analysis/claude-code-rebuild/`.

The goal is not to say "Code Orb is missing features".

The goal is to answer:

1. What structural ideas from Claude Code matter for `code-orb`
2. Which of those matter for `v0`
3. Which ones should be explicitly deferred

This analysis assumes `code-orb` is still a docs-first bootstrap project with minimal runtime implementation.

## Current Code Orb State

At the moment, `code-orb` is intentionally very early:

- `apps/cli/src/main.ts` is still a scaffold entry point
- `packages/core/src/index.ts` is still a scaffold
- `packages/schemas/src/index.ts` defines only a minimal session event envelope
- architecture docs define intended boundaries, but not a concrete runtime design

This is not a failure state.

It means the project is still choosing its shape before implementation hardens.

## High-Level Comparison

Claude Code already has:

- a production query loop
- a rich tool protocol
- a session and transcript model
- a skill system
- a subagent/task runtime
- recovery logic for multi-step tool-driven execution

Code Orb currently has:

- a clean package boundary plan
- an intentionally simple execution model
- a coarse tool contract
- a coarse event model
- a safety model direction
- almost no implementation baggage

This is a strong starting point, because `code-orb` can adopt the useful structure without inheriting Claude Code's accumulated complexity.

## The Real Gap

The main gap is not "missing commands" or "missing tools".

The main gap is:

- Claude Code has an explicit runtime model
- Code Orb currently has mostly architectural intent

So the first job is to turn architecture intent into runtime contracts.

## What Matters For V0

For `code-orb` v0, the highest-value gaps to close are these.

### 1. Session And Turn Model

Current state:

- `docs/architecture/execution-model.md` defines lifecycle phases
- but does not define the concrete runtime objects that carry a session

Missing:

- what a session object is
- what a turn object is
- whether one user request can involve multiple model calls
- how retries and verification loop back into session state

Why Claude Code matters here:

- Claude Code separates session-level state from single-turn loop state
- this prevents "one big function" architecture

Recommendation:

- define a `SessionRuntime` and a `TurnRuntime`
- make explicit that one user request may require multiple model/tool iterations

Priority:

- must-have for v0

### 2. Agent Loop Contract

Current state:

- `code-orb` documents lifecycle phases
- but not the actual agent loop semantics

Missing:

- where planning happens
- when tool execution happens
- how tool results re-enter model context
- when the loop stops
- what "retry" means structurally

Why Claude Code matters here:

- its query loop is a real orchestration loop, not a simple request/response wrapper

Recommendation:

- define a minimal agent loop document and types before implementation expands
- keep it smaller than Claude Code, but explicit

Priority:

- must-have for v0

### 3. Tool Runtime Contract

Current state:

- `docs/architecture/tool-system.md` defines a good direction
- current tool contract is still coarse

Missing:

- `readOnly` vs side-effecting is mentioned, but not fully modeled
- no concurrency semantics
- no interrupt semantics
- no approval integration contract
- no standardized execution metadata envelope
- no result persistence / truncation strategy

Why Claude Code matters here:

- its tool system is not just schemas; it encodes runtime behavior

Recommendation:

- expand tool contracts to include:
  - tool category
  - read-only vs mutating
  - approval requirement
  - timeout policy
  - interrupt behavior
  - execution metadata shape

Priority:

- must-have for v0

### 4. Safety Model Wiring

Current state:

- `docs/architecture/safety-model.md` defines allow / confirm / deny

Missing:

- where policy evaluation happens
- how tools request approval
- how approved/denied actions are recorded
- whether approval is per tool, per command, per path, or per session

Why Claude Code matters here:

- it treats permission as a first-class runtime concern, not an afterthought inside tool code

Recommendation:

- define a policy decision contract before implementing mutating tools
- make tool execution go through policy evaluation every time

Priority:

- must-have for v0

### 5. Event Granularity

Current state:

- `docs/architecture/protocols/events.md` defines event families

Missing:

- which exact events are emitted for a normal task
- what the terminal UI renders from
- what counts as a durable event versus transient UI state
- how tool execution, verification, and final report are represented

Why Claude Code matters here:

- it has a rich internal message/event stream, even if `code-orb` should keep its own model simpler

Recommendation:

- define the minimum useful event stream for v0:
  - `session.started`
  - `session.finished`
  - `plan.generated`
  - `tool.started`
  - `tool.finished`
  - `tool.denied`
  - `verify.started`
  - `verify.finished`
  - `report.generated`
  - `error.raised`

Priority:

- must-have for v0

## What Should Be Explicitly Deferred

These are valuable in Claude Code, but should not be adopted early in `code-orb`.

### 1. Multi-Agent / Subagent Runtime

Claude Code has:

- `runAgent()`
- subagent contexts
- sidechain transcripts
- teammate/task runtime

`code-orb` currently marks multi-agent execution as out of scope in v0.

Recommendation:

- keep this deferred
- do not design v0 around subagents
- only leave extension seams so subagents can be added later

Priority:

- explicitly deferred

### 2. Dynamic Skill Discovery

Claude Code supports:

- filesystem-discovered skills
- conditional path-activated skills
- plugin skills
- MCP skills

For `code-orb` v0, this is too much.

Recommendation:

- if skills are needed at all in v0, keep them static and local
- otherwise defer skills entirely until the core loop and tool model are stable

Priority:

- likely deferred

### 3. Complex Context Compaction

Claude Code has multiple overlapping systems:

- snip
- microcompact
- autocompact
- context collapse
- reactive compact

Recommendation:

- do not copy this stack into v0
- start with explicit token budgeting and hard stops
- add compaction only after real pressure is observed

Priority:

- deferred

### 4. Plugin And MCP Ecosystem

Claude Code has broad extension surfaces.

`code-orb` v0 explicitly excludes a general plugin ecosystem.

Recommendation:

- keep external tool/provider ecosystems deferred
- document future extension points without implementing them now

Priority:

- deferred

## What Code Orb Can Borrow Safely

There are several ideas worth borrowing now without importing Claude Code complexity.

### 1. Separate Conversation State From Turn Loop

Borrow:

- one object for session state
- one loop for single-task execution

Do not borrow:

- all of Claude Code's recovery branches

### 2. Treat Tool Execution As Its Own Runtime Layer

Borrow:

- tool registry
- tool execution dispatcher
- approval integration

Do not borrow:

- per-tool UI rendering contract inside the core runtime

### 3. Keep Events As First-Class Artifacts

Borrow:

- append-only event mindset
- CLI renders from events

Do not borrow:

- overly rich message taxonomy too early

### 4. Make Deferred Features Explicit In Docs

Claude Code accumulated many capabilities over time.

Code Orb has the advantage of being able to say:

- not now
- not v0
- maybe later

That explicitness is valuable.

## Suggested Next Documentation Moves

Before writing much more implementation, `code-orb` should probably add or expand these authoritative docs:

### 1. Expand `docs/architecture/execution-model.md`

Add:

- session object
- turn object
- loop transitions
- retry semantics
- stop conditions

### 2. Expand `docs/architecture/tool-system.md`

Add:

- tool execution metadata
- approval hook point
- concurrency model
- interrupt behavior
- failure shape

### 3. Expand `docs/architecture/protocols/tool-contracts.md`

Add:

- concrete TypeScript-oriented contract draft
- success/error envelope
- mutating vs read-only shape
- audit metadata

### 4. Expand `docs/architecture/protocols/events.md`

Add:

- event names
- minimal payload examples
- event ordering expectations

### 5. Possibly Add A New Doc

Suggested new document:

- `docs/architecture/runtime-loop.md`

This would become the authoritative home for the actual task loop contract.

## Suggested Implementation Order

For `code-orb`, the most sensible sequence looks like this:

1. define runtime loop contracts
2. define tool contracts and safety wiring
3. define event protocol in concrete terms
4. implement minimal single-session core loop
5. implement a few core tools
6. add verification and final report
7. only then revisit skills, plugins, subagents, or daemons

## Bottom Line

The biggest gap between Claude Code and Code Orb is not feature count.

It is that Claude Code already has a concrete runtime model, while Code Orb still mostly has architecture intent.

That is exactly the right moment to be disciplined.

For v0, Code Orb should adopt:

- explicit session and turn contracts
- an explicit agent loop
- a richer tool runtime contract
- a concrete approval/event model

And it should explicitly defer:

- subagents
- dynamic skills
- plugin ecosystems
- complex compaction systems

That path captures the highest-value lessons from Claude Code without importing its full operational complexity.
