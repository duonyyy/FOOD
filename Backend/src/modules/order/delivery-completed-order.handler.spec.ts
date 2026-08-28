import { DELIVERY_COMPLETED_EVENT } from 'src/common/events/delivery-completed.event';
import { DeliveryCompletedOrderHandler } from './delivery-completed-order.handler';

describe('DeliveryCompletedOrderHandler', () => {
  it('subscribes and delegates completion to Ordering', async () => {
    let subscribedHandler: ((event: { orderId: string }) => Promise<void>) | undefined;
    const eventBus = {
      subscribe: jest.fn((_eventName: string, handler: typeof subscribedHandler) => {
        subscribedHandler = handler;
        return jest.fn();
      }),
    };
    const orderCommandService = {
      completeFromDelivery: jest.fn().mockResolvedValue({ id: 'order-1' }),
    };
    const handler = new DeliveryCompletedOrderHandler(
      eventBus as never,
      orderCommandService as never,
    );

    handler.onModuleInit();
    await subscribedHandler?.({ orderId: 'order-1' });

    expect(eventBus.subscribe).toHaveBeenCalledWith(DELIVERY_COMPLETED_EVENT, expect.any(Function));
    expect(orderCommandService.completeFromDelivery).toHaveBeenCalledWith('order-1');
  });

  it('unsubscribes when the module is destroyed', () => {
    const unsubscribe = jest.fn();
    const eventBus = { subscribe: jest.fn(() => unsubscribe) };
    const handler = new DeliveryCompletedOrderHandler(eventBus as never, {} as never);

    handler.onModuleInit();
    handler.onModuleDestroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
