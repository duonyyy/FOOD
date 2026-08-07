import { InProcessEventBus } from './in-process-event-bus.service';

describe('InProcessEventBus', () => {
  it('awaits handlers and removes them when unsubscribed', async () => {
    const eventBus = new InProcessEventBus();
    const handler = jest.fn<Promise<void>, [{ orderId: string }]>().mockResolvedValue(undefined);
    const unsubscribe = eventBus.subscribe('payment.succeeded', handler);

    await eventBus.publish('payment.succeeded', { orderId: 'order-1' });
    unsubscribe();
    await eventBus.publish('payment.succeeded', { orderId: 'order-2' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ orderId: 'order-1' });
  });
});
