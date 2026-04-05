import type { RuntimeEvent } from "@code-orb/schemas";

import type { EventSink } from "./event-sink.js";

export class MemoryEventSink implements EventSink {
  readonly events: RuntimeEvent[] = [];

  emit(event: RuntimeEvent): void {
    this.events.push(event);
  }
}
