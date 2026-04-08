import type { StepRuntimeState, TurnReport, TurnRuntimeState } from "@code-orb/schemas";

import type { AgentEngine, AgentExecutionContext } from "./agent-engine.js";
import { BasicTurnQueryLoop } from "./basic-turn-query-loop.js";
import type { TurnQueryLoop } from "./turn-query-loop.js";

export class BasicAgentEngine implements AgentEngine {
  constructor(private readonly turnQueryLoop: TurnQueryLoop = new BasicTurnQueryLoop()) {}

  runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport> {
    return this.turnQueryLoop.runTurn(turn, context);
  }

  runStep(step: StepRuntimeState, context: AgentExecutionContext): Promise<StepRuntimeState> {
    return this.turnQueryLoop.runStep(step, context);
  }
}
