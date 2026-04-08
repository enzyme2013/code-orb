# Code Orb

Code Orb is a CLI-first coding agent project with a future path to desktop.

The repository is now in an early runnable stage.

Today it provides:

- a one-shot CLI path with `orb run "<task>"`
- an interactive foreground CLI with `orb chat`
- local session artifacts under `.orb/sessions/`
- git-aware session reporting for pre-existing vs current-run changes
- benchmark-backed validation for key milestone paths

The current product shape is still intentionally narrow. The shell and runtime are real, but the CLI is still experimental and not yet a production-ready coding tool.

Release status:

- `0.4.0` Session And Git Awareness: released
- `0.5.0` Interactive CLI: released on 2026-04-08
- `0.6.0` Extensibility: released on 2026-04-08
- `0.7.0` Query Loop And Tool Runtime: released on 2026-04-08
- `0.8.0` Usable CLI: planned

## Read First

- [AGENTS.md](./AGENTS.md)
- [docs/product/vision.md](./docs/product/vision.md)
- [docs/product/v0-scope.md](./docs/product/v0-scope.md)
- [docs/architecture/overview.md](./docs/architecture/overview.md)
- [docs/roadmap/roadmap.md](./docs/roadmap/roadmap.md)

## Quick Start

Install dependencies:

```bash
pnpm install
```

Configure a real provider:

```bash
cp .env.example .env.local
```

or:

```bash
bash scripts/setup-local-env.sh
```

Then edit `.env.local` and set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- optionally `OPENAI_BASE_URL` for an OpenAI-compatible endpoint

Provider notes:

- Code Orb automatically loads `.env` and `.env.local` from the active working directory
- shell environment variables still override `.env` file values
- if no provider variables are set, Code Orb falls back to the mock model client

## Running

Interactive CLI:

```bash
pnpm run cli:run -- chat
```

One-shot task execution:

```bash
pnpm run cli:run -- run "<task>"
```

Run against another repository:

```bash
pnpm run cli:run -- --cwd /path/to/repo chat
pnpm run cli:run -- --cwd /path/to/repo run "<task>"
```

Session inspection:

```bash
pnpm run cli:run -- sessions list
pnpm run cli:run -- sessions show <session-id>
```

Interactive commands:

- `/help`
- `/status`
- `/exit`
- `/quit`
- `exit`
- `quit`

## Benchmarks

Primary benchmark path:

```bash
pnpm run benchmark:failing-test-fix
```

Interactive CLI milestone benchmark:

```bash
pnpm run benchmark:interactive-multi-turn
```

## Current Scope

Code Orb is currently best suited for:

- fixture or small local-repository tasks
- explicit edit-and-verify requests
- interactive multi-turn iteration in one foreground session
- session-aware follow-up work and repository-state inspection

It is not yet a broadly capable general coding agent. The current runtime is still narrow in task interpretation and tool selection, and repository guidance such as `AGENTS.md` is not yet a fully modeled runtime instruction surface.

## Repository Layout

```text
apps/         App entry points such as the CLI and, later, desktop shells.
packages/     Shared runtime packages used by multiple apps.
docs/         Product, architecture, ADR, roadmap, engineering, and reference docs.
prompts/      Prompt assets managed as first-class project artifacts.
tests/        Unit, integration, end-to-end, and fixture repositories.
benchmarks/   Benchmark tasks and evaluation repositories for milestone validation.
scripts/      Automation scripts that support development and release work.
```

## Key Docs

- contributor and agent rules: [AGENTS.md](./AGENTS.md)
- product scope: [docs/product/v0-scope.md](./docs/product/v0-scope.md)
- product direction: [docs/product/vision.md](./docs/product/vision.md)
- architecture overview: [docs/architecture/overview.md](./docs/architecture/overview.md)
- execution model: [docs/architecture/execution-model.md](./docs/architecture/execution-model.md)
- provider runtime: [docs/architecture/provider-runtime.md](./docs/architecture/provider-runtime.md)
- tool system: [docs/architecture/tool-system.md](./docs/architecture/tool-system.md)
- roadmap: [docs/roadmap/roadmap.md](./docs/roadmap/roadmap.md)
- `0.5.0` interactive CLI milestone: [docs/roadmap/releases/0.5.0.md](./docs/roadmap/releases/0.5.0.md)
- `0.7.0` query loop and tool runtime milestone: [docs/roadmap/releases/0.7.0.md](./docs/roadmap/releases/0.7.0.md)
- `0.7.0` execution checklist: [docs/roadmap/releases/0.7.0-checklist.md](./docs/roadmap/releases/0.7.0-checklist.md)
- `0.8.0` usable CLI milestone: [docs/roadmap/releases/0.8.0.md](./docs/roadmap/releases/0.8.0.md)

## Working Style

- `AGENTS.md` is the canonical guide for coding agents working in this repository.
- `CLAUDE.md` is intentionally thin and points back to `AGENTS.md`.
- Architecture changes should update the relevant docs in the same patch.
- ADRs are used for decisions that would be expensive to reverse later.
