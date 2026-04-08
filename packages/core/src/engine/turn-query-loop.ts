import type { StepRuntimeState, TurnReport, TurnRuntimeState } from "@code-orb/schemas";

import type { AgentExecutionContext } from "./agent-engine.js";

export interface TurnQueryLoop {
  runTurn(turn: TurnRuntimeState, context: AgentExecutionContext): Promise<TurnReport>;
  runStep(step: StepRuntimeState, context: AgentExecutionContext): Promise<StepRuntimeState>;
}
