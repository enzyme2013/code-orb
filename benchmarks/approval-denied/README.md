# Approval Denied

This benchmark evaluates whether Code Orb reports a blocked edit clearly when a mutating action is rejected at approval time.

The runtime should:

- inspect the repository context
- reach the mutating edit step
- stop when approval is rejected
- report that the edit was blocked rather than failed silently or pretending the task completed

This benchmark is a recommended `0.3.0` validation target for blocked-edit behavior.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:approval-denied
```

This command copies the benchmark repo into a temporary workspace, runs the benchmark-oriented task prompt there with approval rejection enabled, and leaves the source benchmark repo unchanged.
