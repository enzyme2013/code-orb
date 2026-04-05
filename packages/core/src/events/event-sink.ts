import type { RuntimeEvent } from "@code-orb/schemas";

export interface EventSink {
  emit(event: RuntimeEvent): Promise<void> | void;
}
