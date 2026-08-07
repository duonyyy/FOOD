import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { PAYMENT_SUCCEEDED_EVENT } from 'src/common/events/payment-succeeded.event';
import { pubSub } from 'src/pubsub';
import { OrderService } from './order.service';
import { PaymentSucceededOrderHandler } from './payment-succeeded-order.handler';

describe('PaymentSucceededOrderHandler', () => {
  it('delegates the status transition and keeps the existing orderCreated publication', async () => {
    const eventBus = new InProcessEventBus();
    const orderService = {
      updateOrderStatus: jest.fn().mockResolvedValue({ id: 'order-1', status: 'pending' }),
    } as Pick<OrderService, 'updateOrderStatus'>;
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    const handler = new PaymentSucceededOrderHandler(eventBus, orderService as OrderService);

    handler.onModuleInit();
    await eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      paymentId: 'payment-1',
    });
    handler.onModuleDestroy();

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'pending');
    expect(publishSpy).toHaveBeenCalledWith('orderCreated', {
      orderCreated: { id: 'order-1', status: 'pending' },
    });

    publishSpy.mockRestore();
  });
});
