# Changelog

All notable changes to this project will be documented in this file.

The project intends to follow Keep a Changelog and Semantic Versioning once the first public release is cut.

## [Unreleased]

## [0.2.0] - 2026-04-06

### Added

- repository-managed prompt assets for the system, planner, executor, and final reporting baseline
- a benchmark-driven failing-test-fix task path and end-to-end coverage for the `0.2.0` alpha target
- a broader small-task alpha set beyond the initial replacement-only path

### Changed

- improved CLI usability for local-repository execution, including clearer benchmark entry points and approval behavior
- broadened task intake, repository understanding, planning, and tool selection beyond one narrow replacement-oriented flow
- strengthened final reporting so benchmark-oriented runs explain changes, validation, and remaining risk more clearly
- isolated the failing-test-fix benchmark runner so repeated benchmark execution does not mutate the source benchmark repository

## [0.1.0] - 2026-04-05

### Added

- docs-first project scaffold and repository conventions
- architecture, roadmap, ADR, and reference documentation baseline
- runtime contracts for session, turn, step, events, tools, policy, model, and reports
- minimal core runtime skeleton with session runner, agent engine, and event sink
- Phase 1 and Phase 2 review checklists
- Vitest-based unit, integration, and e2e test scaffold
- minimal CLI runtime wiring with event-driven rendering
- single-provider model adapter path plus mock fallback
- builtin repository and verification tools for a narrow MVP loop
- fixture-based end-to-end proof for prompt -> inspect -> edit -> verify -> report
