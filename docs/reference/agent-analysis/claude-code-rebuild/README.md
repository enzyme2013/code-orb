# Claude Code Rebuild Notes

This directory stores reference notes derived from reviewing the Claude Code 2.1.88 rebuild and the bundled Claude Agent SDK package.

## Documents

- `2026-04-05-claude-sdk-claude-code-notes.md`
  - What `claude-agent-sdk` is for, what capabilities it exposes, and why it should be treated as a Claude Code integration layer rather than a provider-agnostic runtime core.
- `2026-04-05-agent-runtime-architecture.md`
  - A reference architecture draft for building an independent coding-agent runtime with agents, subagents, skills, tools, permissions, and multiple LLM providers.
- `2026-04-05-claude-code-query-engine-and-loop.md`
  - How a single user input becomes an agentic multi-step query loop, including retries, recoveries, tool follow-up turns, and result aggregation.
- `2026-04-05-claude-code-tool-system.md`
  - Tool abstraction, registration, concurrency model, streaming execution, deferred tools, and runtime optimization patterns.
- `2026-04-05-claude-code-skills-and-commands.md`
  - How skills are defined, loaded, discovered, merged into commands, and executed inline vs forked via `SkillTool`.
- `2026-04-05-claude-code-agents-and-tasks.md`
  - How subagents, task types, sidechain transcripts, and shared-vs-isolated runtime contexts are implemented.
- `2026-04-05-code-orb-gap-analysis.md`
  - A high-level gap analysis that maps the Claude Code reference against Code Orb's current docs-first bootstrap state, separating v0 must-haves from features that should be explicitly deferred.

## Source

These files were copied or derived from analysis created in:

- a local `ClaudeCodeRev` analysis workspace under its `docs/` directory

They are reference material for design exploration, not authoritative product decisions for `code-orb`.
