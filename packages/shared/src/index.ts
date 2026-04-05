export interface Result<TOk, TError> {
  ok: boolean;
  value?: TOk;
  error?: TError;
}
