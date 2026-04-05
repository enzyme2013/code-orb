# Failing Test Fix

This benchmark evaluates whether Code Orb can handle a small but real maintenance task on an existing repository:

- inspect repository context
- identify failing tests
- locate the relevant implementation
- make a minimal fix
- run verification
- report the outcome clearly

This benchmark is the recommended primary evaluation target for `0.2.0`.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:failing-test-fix
```

This command copies the benchmark repo into a temporary workspace, runs the benchmark-oriented task prompt there, and leaves the source benchmark repo unchanged.
