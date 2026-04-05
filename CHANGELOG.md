# Changelog

All notable changes to this project will be documented in this file.

The project intends to follow Keep a Changelog and Semantic Versioning once the first public release is cut.

## [Unreleased]

## [0.3.0] - 2026-04-06

### Added

- explicit edit failure classification for blocked edits, target-not-found edits, and tool-level edit failures
- additional `0.3.0` benchmark tracks for verification-still-fails and approval-denied edit outcomes
- automated coverage for edit target mismatch, verify-still-failed, and blocked edit reporting paths

### Changed

- strengthened the edit-and-verify loop so successful edits, failed verification reruns, and blocked edits produce distinct outcomes
- aligned session outcome reporting with turn outcome reporting so failed and blocked runs no longer appear as completed sessions
- improved terminal reporting to show turn status, session outcome, changed files, validation results, and remaining risk more clearly

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
