# Execution Model

## Default Model

The default execution model remains a single-process CLI runtime.

There are now two foreground entry modes:

- in one-shot mode, one user request maps to one foreground session
- in interactive mode, one foreground session may contain many user turns until the session exits

This is a deliberate simplification so that the project can validate the agent loop before introducing daemons, background workers, or multi-agent scheduling.

## Runtime Objects

The runtime should distinguish three levels:

- `Session`: a continuous working conversation or one-shot command execution
- `Turn`: one user input and the system work needed to fulfill it
- `Step`: one internal iteration inside a turn

This separation matters because a single user turn may require multiple model calls, multiple tool calls, and multiple verification attempts.

### Session

A session is the outer execution container.

Examples:

- in a one-shot CLI command, one invocation usually creates one session with one turn
- in `orb chat`, one session may contain many turns until the session is cleared or closed

### Turn

A turn corresponds to one user request.

A turn should own:

- the user input that triggered work
- the turn-scoped plan or subgoal
- the ordered steps taken to satisfy that request
- the turn result reported back to the shell

For V0.1, the turn-scoped plan should be represented as structured plan items rather than plain strings so future execution tracking is possible without redesigning the contract.

### Step

A step is the smallest orchestration unit inside a turn.

A step may include:

- preparing context for the next model call
- one model interaction
- zero or more tool calls
- verification or repair work

This means `Turn` is a user-facing boundary, while `Step` is an internal runtime boundary.

## Session Lifecycle

Each session should move through these phases:

1. bootstrap
2. turn intake
3. turn execution
4. verification and repair as needed
5. turn report
6. final session report

For `0.4.0`, each completed or failed foreground session also writes a local session artifact under the working repository so later CLI inspection and follow-up work can reference the prior result explicitly.

The artifact is not a resumable execution checkpoint. It is a persisted session report plus repository-state context and optional prior-session linkage.

## Turn Lifecycle

Within a turn, the expected flow is:

1. create turn context
2. gather or refine context
3. generate or update a short plan
4. run one or more internal steps
5. verify results
6. complete the turn with a structured outcome

## Step Lifecycle

The initial step lifecycle should stay simple:

1. prepare context
2. request model output or perform deterministic system work
3. execute any requested tools through the tool executor
4. feed results back into turn state
5. decide whether to continue, verify, or stop

## Retry Behavior

Retries should be explicit and bounded. The system should avoid invisible loops that keep mutating the repository without a clear stopping condition.

Initial policy:

- in one-shot mode, one task owns one working session
- in interactive mode, one working session can own many user turns
- one user input creates one turn
- retries happen at the step level inside a turn
- retries are recorded as events
- verification failures should feed back into turn state, not bypass it
- hard stops should happen when safety policy denies the next step

## Why Turn And Step Are Separate

Code Orb should not overload `Turn` to mean both user interaction and internal loop iteration.

Recommended interpretation:

- `Session` is the long-lived conversation or command container
- `Turn` is a single user request
- `Step` is the internal agent loop iteration unit

This keeps user-facing semantics clear while preserving room for a multi-step orchestration loop.

## Why Not A Daemon Yet

A daemon can improve responsiveness and state reuse later, but it introduces lifecycle management, client/server contracts, and new failure modes. Those costs are not justified until the core loop is stable.

## Evolution Path

If a local daemon is introduced later, it should preserve:

- the same logical session lifecycle
- the same turn and step semantics
- the same event protocol
- the same tool contracts where possible

Only the hosting model should change, not the product semantics.

## V0.4 Additions

The `0.4.0` runtime extends the single-process CLI model with local continuity, not background execution.

Specifically:

- `orb run` persists a session artifact in `.orb/sessions/`
- `orb sessions list` and `orb sessions show <session-id>` inspect that local store
- git-backed runs capture before and after working-tree snapshots
- final session reporting distinguishes pre-existing repository changes from current-run changes
- `orb run --from-session <session-id> ...` injects a prior-session summary into the new run's planning context

This preserves the one-run-one-session execution model while making the CLI aware of prior local work.

## V0.5 Additions

The `0.5.0` runtime keeps the same core session, turn, and step semantics while exposing an interactive foreground shell.

Specifically:

- `orb chat` starts one foreground interactive session
- each interactive user input creates a new turn in that session
- `/help`, `/status`, and `/exit` are handled by the CLI shell layer as interactive control commands
- the session persists one final artifact containing all turn reports when the interactive session exits
- same-session follow-up requests can reference the previous turn through session-scoped context instead of using `--from-session`

This extends the CLI from one-shot commands to multi-turn foreground interaction without introducing daemon mode or changing the core runtime boundaries.
