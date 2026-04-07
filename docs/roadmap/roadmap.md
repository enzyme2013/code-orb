# Roadmap

## Versioning Policy

- `0.0.x` is for internal bootstrap and scaffolding.
- `0.1.0` is the first end-to-end demonstrable CLI milestone.
- `0.x` minor releases should represent real capability milestones, not arbitrary time slices.
- `1.0.0` is reserved for a stable CLI contract and core protocol surface.

## Milestones

### 0.1.0 Foundation

- runtime contracts for session, turn, step, tools, policy, and events
- a minimal runnable CLI loop on fixture repositories
- repository read, edit, and verify path with a safety gate
- clear shell/core/adapter boundaries that can support later shells and providers

Current status:

- released on 2026-04-05

This milestone is expected to progress through two phases:

- Phase 1: runtime contracts and architectural hardening
- Phase 2: minimal end-to-end runnable loop

Phase detail:

- [phase-1-runtime-contracts.md](./phases/phase-1-runtime-contracts.md)
- [phase-2-minimal-loop.md](./phases/phase-2-minimal-loop.md)

Release detail: [releases/0.1.0.md](./releases/0.1.0.md)

### 0.2.0 Runnable Alpha

- make the CLI runnable and understandable for real local-repository usage
- broaden task handling beyond the current narrow replacement-oriented MVP path
- improve repository understanding, planning, and tool selection
- strengthen approval UX, reporting, and fixture coverage for real alpha usage
- use `benchmarks/failing-test-fix/` as the primary validation target

Current status:

- released on 2026-04-06

Release detail: [releases/0.2.0.md](./releases/0.2.0.md)
- checklist: [releases/0.2.0-checklist.md](./releases/0.2.0-checklist.md)

### 0.3.0 Edit And Verify

- more robust patch flow
- verification loops and clearer failure handling
- structured final report improvements

Current status:

- released on 2026-04-06

Release detail: [releases/0.3.0.md](./releases/0.3.0.md)

### 0.4.0 Session And Git Awareness

- stronger session persistence
- git-aware safety and diff helpers
- resume-oriented artifacts

Current status:

- released on 2026-04-06

Release detail: [releases/0.4.0.md](./releases/0.4.0.md)
- todo: [releases/0.4.0-todo.md](./releases/0.4.0-todo.md)

### 0.5.0 Interactive CLI

- move from one-shot `orb run` toward a persistent interactive CLI session
- support multiple turns within one local foreground session
- establish the minimal interactive command surface and session UX needed for iterative coding work

Current status:

- released on 2026-04-08
- initial interactive shell and session model landed on 2026-04-06
- release-closeout usability fixes landed on 2026-04-08 to restore assistant reply rendering, provider reply recovery, and basic single-file generated writes inside `orb chat`

Release detail: [releases/0.5.0.md](./releases/0.5.0.md)

### 0.6.0 Extensibility

- provider abstraction maturity
- external tool registration boundaries
- replace tactical provider-specific fallbacks with clearer adapter behavior and documented compatibility boundaries
- replace the current heuristic generated-file path with a more explicit execution path for assistant-produced edits
- define the explicit contracts that a real query loop and tool runtime will build on
- groundwork for alternate shells

Current status:

- released on 2026-04-08

Release detail: [releases/0.6.0.md](./releases/0.6.0.md)

### 0.7.0 Query Loop And Tool Runtime

- replace task-specific execution branches with a clearer turn-level query loop
- make tool execution, verification, retry, and stop conditions explicit runtime transitions
- introduce a real tool registration and orchestration boundary inside core
- align Code Orb more closely with the Claude Code-derived runtime shape without importing full Claude Code product breadth

Current status:

- planned

Release detail: [releases/0.7.0.md](./releases/0.7.0.md)

### 0.8.0 Usable CLI

- move the CLI from an experimental demo toward a tool that can support real local-repository work predictably
- harden execution, verification, and recovery behavior on common coding tasks
- improve failure reporting, approval clarity, and benchmark-backed reliability
- prove the CLI is usable before investing in major shell-polish or desktop work

Current status:

- planned

Release detail: [releases/0.8.0.md](./releases/0.8.0.md)

### 0.9.0 CLI UX And TUI

- improve the interactive CLI experience after the runtime is already usable
- upgrade terminal rendering, interaction flow, and session ergonomics
- add TUI-oriented improvements without redefining core runtime semantics
- make iterative coding work faster and easier to inspect from the terminal

Current status:

- planned

Release detail: [releases/0.9.0.md](./releases/0.9.0.md)

### 0.10.0 Workspace Context And Configuration

- make project guidance, runtime configuration, and provider selection first-class parts of normal use
- expand beyond minimal `AGENTS.md` support into a clearer instruction and configuration model
- add provider profiles and configuration behavior that are explicit instead of environment-variable folklore

Current status:

- planned

Release detail: [releases/0.10.0.md](./releases/0.10.0.md)

### 0.11.0 Memory And Skills

- add explicit, inspectable memory beyond the current narrow session-follow-up model
- support reusable project or user skills without collapsing them into the tool layer
- improve continuity and repeatability for guided coding workflows

Current status:

- planned

Release detail: [releases/0.11.0.md](./releases/0.11.0.md)

### 0.12.0 MCP And Plugin Boundaries

- open a deliberate path for external tool ecosystems after the core runtime, CLI usability, and skill model are already in place
- define MCP and plugin boundaries without turning the runtime into a marketplace-first product
- keep extension behavior aligned with core tool, event, and safety contracts

Current status:

- planned

Release detail: [releases/0.12.0.md](./releases/0.12.0.md)

## Later Direction

- desktop-oriented shells remain intentionally deferred until after the CLI is usable, ergonomically solid, and context-aware
- any future desktop milestone should build on the explicit runtime loop and tool runtime established earlier, rather than introducing them for the first time
- generalized multi-agent or delegation work should remain later than the instruction, memory, skill, and extension-boundary milestones

## Roadmap Rules

- each milestone should define `in scope`, `out of scope`, and `exit criteria`
- roadmap changes should be intentional, not silent drift
- if a milestone gets split, update both the roadmap and any affected release docs
