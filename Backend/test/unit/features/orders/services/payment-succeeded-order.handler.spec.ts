import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { PAYMENT_SUCCEEDED_EVENT } from 'src/common/events/payment-succeeded.event';
import { AdminOrdersService } from 'src/features/orders/services/admin-orders.service';
import { PaymentSucceededOrderHandler } from 'src/features/orders/services/order-events.handler';

describe('PaymentSucceededOrderHandler', () => {
  it('delegates payment completion to the idempotent Ordering command', async () => {
    const eventBus = new InProcessEventBus();
    const adminOrdersService = {
      markPaid: jest.fn().mockResolvedValue({ id: 'order-1', status: 'completed', isPaid: true }),
    } as Pick<AdminOrdersService, 'markPaid'>;
    const handler = new PaymentSucceededOrderHandler(
      eventBus,
      adminOrdersService as AdminOrdersService,
    );

    handler.onModuleInit();
    await eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      paymentId: 'payment-1',
    });
    handler.onModuleDestroy();

    expect(adminOrdersService.markPaid).toHaveBeenCalledWith('order-1');
  });
});
