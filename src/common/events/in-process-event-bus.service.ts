import { Injectable } from '@nestjs/common';

type EventHandler = (event: unknown) => Promise<void> | void;

@Injectable()
export class InProcessEventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe<TEvent>(
    eventName: string,
    handler: (event: TEvent) => Promise<void> | void,
  ): () => void {
    const eventHandlers = this.handlers.get(eventName) ?? new Set<EventHandler>();
    const registeredHandler = handler as EventHandler;

    eventHandlers.add(registeredHandler);
    this.handlers.set(eventName, eventHandlers);

    return () => {
      eventHandlers.delete(registeredHandler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  async publish<TEvent>(eventName: string, event: TEvent): Promise<void> {
    const eventHandlers = this.handlers.get(eventName);
    if (!eventHandlers) {
      return;
    }

    for (const handler of eventHandlers) {
      await handler(event);
    }
  }
}
