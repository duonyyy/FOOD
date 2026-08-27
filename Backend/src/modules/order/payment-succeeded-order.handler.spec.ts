import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { PAYMENT_SUCCEEDED_EVENT } from 'src/common/events/payment-succeeded.event';
import { OrderCommandService } from './order-command.service';
import { PaymentSucceededOrderHandler } from './payment-succeeded-order.handler';

describe('PaymentSucceededOrderHandler', () => {
  it('delegates payment completion to the idempotent Ordering command', async () => {
    const eventBus = new InProcessEventBus();
    const orderCommandService = {
      markPaid: jest.fn().mockResolvedValue({ id: 'order-1', status: 'completed', isPaid: true }),
    } as Pick<OrderCommandService, 'markPaid'>;
    const handler = new PaymentSucceededOrderHandler(
      eventBus,
      orderCommandService as OrderCommandService,
    );

    handler.onModuleInit();
    await eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      paymentId: 'payment-1',
    });
    handler.onModuleDestroy();

    expect(orderCommandService.markPaid).toHaveBeenCalledWith('order-1');
  });
});
