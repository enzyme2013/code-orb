export interface SessionEvent<TPayload = unknown> {
  id: string;
  sessionId: string;
  type: string;
  timestamp: string;
  payload: TPayload;
}
