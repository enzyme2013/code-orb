# Existing Changes Awareness

This benchmark evaluates whether Code Orb can report repository context accurately when the repository is already dirty before the run starts.

The runtime should:

- preserve awareness of pre-existing dirty files
- complete a small requested edit
- report current-run changes separately from pre-existing changes
- show overlap explicitly when a current run touches an already-dirty file

This benchmark is a recommended `0.4.0` validation target.

## Contents

- [task.md](./task.md): task description, constraints, and acceptance criteria
- `repo/`: the benchmark repository used for this task

## Recommended Invocation

From the repository root:

```bash
pnpm run benchmark:existing-changes-awareness
```

This command copies the benchmark repo into a temporary workspace, initializes git state there, runs the benchmark-oriented task prompt, and leaves the source benchmark repo unchanged.
