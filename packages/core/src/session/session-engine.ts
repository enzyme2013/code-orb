import type { SessionInput, SessionReport, SessionRuntimeState, TurnInput, TurnReport, TurnRuntimeState } from "@code-orb/schemas";

import type { SessionRunnerContext } from "./session-runner.js";

export interface SessionEngine {
  run(input: SessionInput, context: SessionRunnerContext): Promise<SessionReport>;
  createSession(input: SessionInput): SessionRuntimeState;
  createTurn(session: SessionRuntimeState, input: TurnInput): TurnRuntimeState;
  runTurn(session: SessionRuntimeState, input: TurnInput, context: SessionRunnerContext): Promise<TurnReport>;
  completeSession(session: SessionRuntimeState, context: SessionRunnerContext): Promise<SessionReport>;
  failSession(session: SessionRuntimeState, context: SessionRunnerContext, error: unknown): Promise<SessionReport>;
}
