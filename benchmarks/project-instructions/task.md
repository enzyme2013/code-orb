# Project Instructions Task

## Goal

Run a normal CLI task inside a repository that defines `AGENTS.md`, and prove that Code Orb loaded and surfaced that guidance as part of ordinary execution.

## Expected Agent Behaviors

The agent should:

1. start a normal one-shot session in the benchmark repository
2. discover the repository `AGENTS.md`
3. include that instruction source in user-visible CLI reporting
4. persist the instruction source in the saved session artifact

## Constraints

- the benchmark should not rely on hidden environment-specific state
- the runtime should not require manual prompt editing to load project guidance
- the instruction source should be inspectable after the run

## Acceptance Criteria

The benchmark is successful when:

- CLI output includes `Project instructions: AGENTS.md`
- the saved session artifact records `AGENTS.md` under project instructions
- the run completes successfully
