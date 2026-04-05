# Repo Playbook

This document expands on [AGENTS.md](../../AGENTS.md) with task-oriented guidance for coding agents.

## Task Intake Checklist

- identify whether the task is product, architecture, or implementation work
- read the smallest relevant doc set before editing
- note whether an ADR or roadmap update is required

## Change Planning Heuristic

- if the change affects user-visible scope, update `docs/product/`
- if it affects runtime boundaries, update `docs/architecture/`
- if it changes a durable decision, add or update an ADR
- if it changes milestone sequencing, update `docs/roadmap/`
- if it records supporting research or another agent's analysis, store it under `docs/reference/`

## Reporting Expectations

A useful change report should state:

- what changed
- why the chosen approach fits the current architecture
- what was validated
- what remains unvalidated

## Path Hygiene

- prefer repository-relative paths in docs, templates, and examples
- avoid committing local absolute paths unless the task specifically requires them
- if a local path appears in generated notes or copied output, normalize it before committing
