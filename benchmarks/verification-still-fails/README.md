# Verification Still Fails

This benchmark evaluates whether Code Orb can handle an edit-and-verify task where the edit succeeds but the verification command still fails.

The point of the benchmark is not to force an additional repair. It is to validate that the runtime:

- performs the requested edit
- reruns verification
- reports that validation still failed
- produces a clear final report without pretending the task succeeded

This benchmark is a recommended `0.3.0` validation target.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:verification-still-fails
```

This command copies the benchmark repo into a temporary workspace, runs the benchmark-oriented task prompt there, and leaves the source benchmark repo unchanged.
