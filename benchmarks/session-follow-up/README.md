# Session Follow-Up

This benchmark evaluates whether Code Orb can continue a second task with explicit prior-session context instead of acting like a blank-slate run.

The runtime should:

- complete an initial run and persist a session artifact
- load that session as follow-up context for a second run
- report the follow-up linkage clearly
- leave both session artifacts inspectable

This benchmark is a recommended `0.4.0` validation target.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:session-follow-up
```

This command copies the benchmark repo into a temporary workspace, runs an initial task, runs a follow-up task from the saved session, and leaves the source benchmark repo unchanged.
