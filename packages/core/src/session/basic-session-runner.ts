import type { SessionInput, SessionReport, SessionRuntimeState, TurnInput, TurnReport, TurnRuntimeState } from "@code-orb/schemas";

import { BasicSessionEngine } from "./basic-session-engine.js";
import type { SessionEngine } from "./session-engine.js";
import type { SessionRunner, SessionRunnerContext } from "./session-runner.js";

export class BasicSessionRunner implements SessionRunner {
  constructor(private readonly sessionEngine: SessionEngine = new BasicSessionEngine()) {}

  createSession(input: SessionInput): SessionRuntimeState {
    return this.sessionEngine.createSession(input);
  }

  createTurn(session: SessionRuntimeState, input: TurnInput): TurnRuntimeState {
    return this.sessionEngine.createTurn(session, input);
  }

  run(input: SessionInput, context: SessionRunnerContext): Promise<SessionReport> {
    return this.sessionEngine.run(input, context);
  }

  runTurn(session: SessionRuntimeState, input: TurnInput, context: SessionRunnerContext): Promise<TurnReport> {
    return this.sessionEngine.runTurn(session, input, context);
  }

  completeSession(session: SessionRuntimeState, context: SessionRunnerContext): Promise<SessionReport> {
    return this.sessionEngine.completeSession(session, context);
  }

  failSession(session: SessionRuntimeState, context: SessionRunnerContext, error: unknown): Promise<SessionReport> {
    return this.sessionEngine.failSession(session, context, error);
  }
}
