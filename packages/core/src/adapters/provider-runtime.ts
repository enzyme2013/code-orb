import type { ModelResponse, ProviderRuntimeState, SessionRuntimeState, TurnRuntimeState } from "@code-orb/schemas";

export interface ProviderRuntime {
  initializeTurn(session: SessionRuntimeState, turn: TurnRuntimeState): void;
  continuationForTurn(turn: TurnRuntimeState): ProviderRuntimeState["modelContinuation"];
  recordModelResponse(
    turn: TurnRuntimeState,
    response: ModelResponse,
    continuationMessageIndex: number,
  ): void;
  commitTurn(session: SessionRuntimeState, turn: TurnRuntimeState): void;
}

export class BasicProviderRuntime implements ProviderRuntime {
  initializeTurn(session: SessionRuntimeState, turn: TurnRuntimeState): void {
    turn.providerState = cloneProviderState(session.providerState);
  }

  continuationForTurn(turn: TurnRuntimeState): ProviderRuntimeState["modelContinuation"] {
    return turn.providerState?.modelContinuation;
  }

  recordModelResponse(
    turn: TurnRuntimeState,
    response: ModelResponse,
    continuationMessageIndex: number,
  ): void {
    const responseId =
      response.continuation?.responseId ?? (typeof response.raw?.id === "string" ? response.raw.id : undefined);

    if (!responseId) {
      return;
    }

    turn.providerState = {
      ...turn.providerState,
      modelContinuation: {
        previousResponseId: responseId,
        continuationMessageIndex,
        assistantToolCalls: response.toolCalls?.length ? response.toolCalls : undefined,
      },
    };
  }

  commitTurn(session: SessionRuntimeState, turn: TurnRuntimeState): void {
    session.providerState = cloneProviderState(turn.providerState);
  }
}

function cloneProviderState(state: ProviderRuntimeState | undefined): ProviderRuntimeState | undefined {
  if (!state) {
    return undefined;
  }

  return {
    modelContinuation: state.modelContinuation
      ? {
          previousResponseId: state.modelContinuation.previousResponseId,
          continuationMessageIndex: state.modelContinuation.continuationMessageIndex,
          assistantToolCalls: state.modelContinuation.assistantToolCalls?.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.name,
            input: { ...toolCall.input },
          })),
        }
      : undefined,
  };
}
