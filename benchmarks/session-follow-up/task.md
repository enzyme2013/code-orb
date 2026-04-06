# Session Follow-Up Task

## Goal

Run an initial task to create a saved session artifact, then run a second task from that session id and report clearly that the second task is a follow-up.

## Expected Agent Behaviors

The agent should:

1. complete an initial session successfully
2. persist the initial session artifact
3. start a second run with `--from-session`
4. include follow-up linkage in final reporting

## Constraints

- the second run must load a real prior session artifact
- the second run should not act like a blank-slate run
- both runs should leave inspectable artifacts in the local session store

## Acceptance Criteria

The benchmark is successful when:

- both runs succeed
- the second run reports `Follow-up from session: <id>`
- the second session artifact stores `followUpFromSessionId`
- `orb sessions list` can see both sessions after the benchmark finishes
