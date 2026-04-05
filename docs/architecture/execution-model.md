# Execution Model

## Default Model

The initial execution model is a single-process CLI runtime. One user request maps to one foreground session.

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
- in a future interactive CLI, one session may contain many turns until the session is cleared or closed

### Turn

A turn corresponds to one user request.

A turn should own:

- the user input that triggered work
- the turn-scoped plan or subgoal
- the ordered steps taken to satisfy that request
- the turn result reported back to the shell

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

- one task owns one working session
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
