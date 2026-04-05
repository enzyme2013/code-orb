# Verification Still Fails Task

## Goal

Apply a requested edit in a small repository, rerun verification, and report clearly when the verification command still fails after the edit was made.

This benchmark is meant to validate the reliability of the edit-and-verify loop, especially the reporting path for partial progress and unresolved failure.

## Expected Agent Behaviors

The agent should:

1. inspect repository context before editing
2. locate the requested edit target
3. apply the requested change
4. rerun verification
5. report that the edit succeeded but verification still failed
6. avoid claiming the task fully succeeded when validation did not pass

## Constraints

- the edit should still be applied if it is safe and unambiguous
- the runtime should not fabricate a second repair when no supported repair path exists
- the final report should preserve both facts:
  - the file changed
  - verification is still failing

## Acceptance Criteria

The benchmark is successful when:

- the requested edit is applied
- `node verify.mjs` is rerun
- the final report includes the changed file
- the final report includes the failed validation
- the final report states that verification still failed after the edit

## Verification Command

Run the benchmark verification from `repo/`:

```bash
node verify.mjs
```
