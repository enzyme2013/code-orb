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

The `Session Engine` owns:

- session lifecycle and session status
- cross-turn state such as prior-turn summaries and follow-up context
- artifact persistence and repository-state observation
- provider-session state that may outlive one turn, such as transport continuation context

### Turn

A turn corresponds to one user request.

A turn should own:

- the user input that triggered work
- the turn-scoped plan or subgoal
- the ordered steps taken to satisfy that request
- the turn result reported back to the shell

For V0.1, the turn-scoped plan should be represented as structured plan items rather than plain strings so future execution tracking is possible without redesigning the contract.

The `Turn Query Loop` owns turn-local orchestration only. It should not become the de facto owner of all session state just because the current implementation is still compact.

### Step

A step is the smallest orchestration unit inside a turn.

A step may include:

- preparing context for the next model call
- one model interaction
- zero or more tool calls
- verification or repair work

The current runtime uses these step kinds:

- `planning` for the initial plan-producing model interaction
- `context` for deterministic repository inspection
- `tool_use` for concrete tool execution
- `verification` for explicit verification commands
- `model` for follow-up model interactions after tool results re-enter turn state

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

1. process input and decide whether the turn needs model execution
2. create turn context
3. gather or refine context
4. generate or update a short plan
5. run one or more internal steps
6. verify results
7. complete the turn with a structured outcome

## Step Lifecycle

The initial step lifecycle should stay simple:

1. prepare context
2. request model output or perform deterministic system work
3. execute any requested tools through the tool executor
4. feed results back into turn state
5. decide whether to continue, verify, or stop

## Current Loop Contract

`0.7.0` turns the previously documented baseline into a reusable turn loop.

The current runtime now interprets one turn this way:

1. start a `planning` step and request the initial model response
2. classify the turn into a runtime intent such as:
   - plan-only completion
   - deterministic replace-and-verify
   - assistant-generated file write
   - failing-test verification and repair
   - model/tool loop when provider capability and model response allow it
3. execute one explicit internal loop iteration at a time
4. feed tool, verification, and repair outcomes back into turn state rather than bypassing it through branch-local return values
5. continue until the loop reaches one terminal stop reason
6. finalize the turn report from loop state, including `stopReason` and step count

This keeps `Turn` as the user-facing boundary while making the internal query loop reusable and inspectable.

## Session Engine Versus Turn Query Loop

For `0.7.0` closeout, Code Orb should treat these as separate runtime responsibilities even if some current classes still colocate them:

- `Session Engine`
  - owns session lifecycle
  - owns cross-turn state
  - owns artifact and repository-state bookkeeping
  - owns provider-session context
- `Turn Query Loop`
  - owns one turn's internal iterations
  - owns step transitions
  - owns stop reasons
  - owns tool, verification, and repair re-entry

`0.8.0` usability work should not need to redefine this boundary.

## Input Processing Boundary

Not every user input should enter the model loop directly.

The runtime should keep an explicit input-processing boundary for work such as:

- slash or shell-local control commands
- task normalization
- project-guidance injection
- local follow-up context assembly

This keeps the turn loop focused on agentic execution rather than becoming a grab bag of shell and preprocessing logic.

## Continue And Stop Conditions

For the current runtime:

- continue conditions are explicit
  - more repository context is required before execution can continue
  - a mutating step completed and verification is still required
  - verification failed and a bounded repair path is still available
  - a tool result was returned to a tool-calling-capable model and another model step is required
- stop conditions are explicit through turn `stopReason`
  - `model_completed`
  - `task_completed`
  - `context_unavailable`
  - `tool_denied`
  - `tool_failed`
  - `verification_failed`
  - `repair_exhausted`
  - `loop_limit_reached`

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

Provider transport retries and continuation fallbacks are separate from turn-loop retries. They belong to the provider adapter boundary, not to ad hoc loop branching.

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
- `/help`, `/history`, `/status`, and `/exit` are handled by the CLI shell layer as interactive control commands
- the session persists one final artifact containing all turn reports when the interactive session exits
- same-session follow-up requests can reference the previous turn through session-scoped context instead of using `--from-session`
- for explicit file-writing requests, the agent engine may translate assistant-generated code blocks into auditable repository writes through the tool executor instead of stopping at a conversational summary

This extends the CLI from one-shot commands to multi-turn foreground interaction without introducing daemon mode or changing the core runtime boundaries.

## V0.6 Baseline

The `0.6.0` baseline kept the implementation intentionally simple while making several semantics explicit:

- provider compatibility behavior that affects runtime correctness must be normalized and documented
- assistant-produced edits should be modeled as explicit runtime edit modes:
  - generated create
  - generated rewrite
  - targeted replacement
- generated edit execution, verification, and stop decisions should be observable as runtime behavior rather than inferred only from conversational output
- the documented current-loop contract should describe real runtime behavior now, even before a fuller reusable loop exists

This baseline was the contract cleanup step that `0.7.0` now extends into the current explicit turn loop.

## V0.7 Query Loop Runtime

The `0.7.0` runtime now adds:

- an explicit turn loop with bounded internal iterations
- loop-owned stop reasons recorded in turn state and turn reports
- a `model` step kind for follow-up model interactions after tool execution
- verification and repair flows that re-enter the same loop state used by other runtime work
- capability-aware tool advertisement to the model when the provider supports tool calling
- adapter-owned continuation behavior for provider-native tool calling, such as prior-response reuse and explicit tool-output handoff

The remaining `0.7.0` closeout work is to make the `Session Engine` versus `Turn Query Loop` ownership model explicit enough that later CLI reliability work does not need to reopen it.

## V0.8 Usability Baseline

The initial `0.8.0` usability work makes repository guidance part of normal runtime execution instead of a shell-only convention.

Specifically:

- session start now discovers repository-root `AGENTS.md` by walking ancestor directories from the active `cwd`
- discovered guidance is injected into the planning request as a runtime-owned system message, alongside existing base prompts and follow-up context
- loaded instruction sources are surfaced in `session.started`, turn reports, session reports, and persisted session artifacts so users can tell when project guidance was active
- mutating approval flow and mutating-action outcomes are surfaced in turn/session reporting instead of only transient terminal prompts
- model-tool-loop turns now stop immediately on denied or failed tool execution outcomes instead of pretending the turn completed after a terminal runtime tool failure

This keeps project-guidance handling inside the runtime input-processing boundary instead of hiding it in CLI-only prompt construction.

The `0.8.0` closeout also hardens repository inspection by excluding `.orb/` session artifacts from normal repository search and listing helpers so saved local session history does not become an accidental edit target.
