# Existing Changes Awareness Task

## Goal

Start from a repository that already has local changes, make the requested README edit, run verification, and report the repository state clearly.

## Expected Agent Behaviors

The agent should:

1. complete the requested README edit
2. run the provided verification command
3. report whether the repository was dirty before the run
4. distinguish pre-existing changes from current-run changes

## Constraints

- the benchmark setup already includes dirty files before the run starts
- the benchmark should not claim that all dirty files were caused by the current run
- the benchmark should leave a saved session artifact for inspection

## Acceptance Criteria

The benchmark is successful when:

- the requested file edit is applied successfully
- verification passes
- final reporting includes repository dirty state
- final reporting includes both pre-existing and current-run change lines when applicable
- the saved session artifact includes change-classification data
