import { Test, TestingModule } from '@nestjs/testing';
import { DELIVERY_COMPLETED_EVENT } from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ORDER_CREATED_EVENT } from 'src/common/events/order-events';
import { PAYMENT_FAILED_EVENT } from 'src/common/events/payment-failed.event';
import { PAYMENT_SUCCEEDED_EVENT } from 'src/common/events/payment-succeeded.event';
import { AnalyticsProjectionHandler } from './analytics-projection.handler';
import { AnalyticsProjectionService } from './analytics-projection.service';

describe('AnalyticsProjectionHandler', () => {
  let handler: AnalyticsProjectionHandler;
  let eventBus: InProcessEventBus;
  let projection: {
    projectOrder: jest.Mock;
    recordPayment: jest.Mock;
    recordDeliveryCompleted: jest.Mock;
  };

  beforeEach(async () => {
    projection = {
      projectOrder: jest.fn().mockResolvedValue(true),
      recordPayment: jest.fn().mockResolvedValue(true),
      recordDeliveryCompleted: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsProjectionHandler,
        InProcessEventBus,
        { provide: AnalyticsProjectionService, useValue: projection },
      ],
    }).compile();
    handler = module.get(AnalyticsProjectionHandler);
    eventBus = module.get(InProcessEventBus);
    handler.onModuleInit();
  });

  afterEach(() => handler.onModuleDestroy());

  it('consumes Ordering, Payment and Delivery events through idempotent projection commands', async () => {
    await eventBus.publish(ORDER_CREATED_EVENT, {
      orderId: 'order-1',
      status: 'pending',
      occurredAt: '2026-09-03T00:00:00.000Z',
    });
    await eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      paymentId: null,
    });
    await eventBus.publish(PAYMENT_FAILED_EVENT, {
      orderId: 'order-2',
      checkoutId: 'checkout-2',
      paymentId: null,
    });
    await eventBus.publish(DELIVERY_COMPLETED_EVENT, {
      orderId: 'order-1',
      shipperId: 'shipper-1',
      shippingDetailId: 'shipping-1',
      completedAt: '2026-09-03T01:00:00.000Z',
      earnings: 10_000,
      deliveryTimeMinutes: 20,
      onTime: true,
    });

    expect(projection.projectOrder).toHaveBeenCalledWith('order-1');
    expect(projection.recordPayment).toHaveBeenNthCalledWith(1, 'order-1', 'COMPLETED');
    expect(projection.recordPayment).toHaveBeenNthCalledWith(2, 'order-2', 'FAILED');
    expect(projection.recordDeliveryCompleted).toHaveBeenCalledWith(
      'order-1',
      'shipper-1',
      '2026-09-03T01:00:00.000Z',
    );
  });

  it('contains projection failures so a replay does not affect the committed source aggregate', async () => {
    projection.recordPayment.mockRejectedValueOnce(new Error('temporary database outage'));

    await expect(
      eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
        orderId: 'order-1',
        checkoutId: 'checkout-1',
        paymentId: null,
      }),
    ).resolves.toBeUndefined();
  });
});
