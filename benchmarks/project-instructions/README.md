# Project Instructions

This benchmark evaluates whether Code Orb treats repository guidance as part of normal CLI execution instead of an out-of-band manual convention.

The runtime should:

- discover the repository `AGENTS.md`
- surface that project guidance was loaded during normal CLI output
- persist the discovered instruction source in the saved session artifact

This benchmark is a recommended `0.8.0` validation target for repository-instruction intake and reporting visibility.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:project-instructions
```
