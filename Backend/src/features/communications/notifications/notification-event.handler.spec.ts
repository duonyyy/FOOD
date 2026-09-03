import { Test, TestingModule } from '@nestjs/testing';
import { DELIVERY_COMPLETED_EVENT } from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { NOTIFICATION_REQUESTED_EVENT } from 'src/common/events/notification-requested.event';
import { ORDER_CREATED_EVENT } from 'src/common/events/order-events';
import { PAYMENT_SUCCEEDED_EVENT } from 'src/common/events/payment-succeeded.event';
import { Notification } from 'src/entities/notification.entity';
import { ORDER_NOTIFICATION_READER } from 'src/features/orders/public-api';
import { pubSub } from 'src/pubsub';
import { NotificationDeadLetterService } from './notification-dead-letter.service';
import { NotificationEventHandler } from './notification-event.handler';
import { NotificationService } from './notification.service';

jest.mock('src/pubsub', () => ({
  pubSub: { publish: jest.fn() },
}));

describe('NotificationEventHandler', () => {
  let handler: NotificationEventHandler;
  let eventBus: InProcessEventBus;
  let notificationService: { createFromEvent: jest.Mock };
  let deadLetterService: { record: jest.Mock };
  let orderNotificationReader: { findNotificationRecipient: jest.Mock };

  beforeEach(async () => {
    notificationService = { createFromEvent: jest.fn() };
    deadLetterService = { record: jest.fn().mockResolvedValue(undefined) };
    orderNotificationReader = {
      findNotificationRecipient: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        customerId: 'customer-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventHandler,
        InProcessEventBus,
        { provide: NotificationService, useValue: notificationService },
        { provide: NotificationDeadLetterService, useValue: deadLetterService },
        { provide: ORDER_NOTIFICATION_READER, useValue: orderNotificationReader },
      ],
    }).compile();

    handler = module.get(NotificationEventHandler);
    eventBus = module.get(InProcessEventBus);
    handler.onModuleInit();
  });

  afterEach(() => {
    handler.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('consumes Order events and persists an event-keyed notification', async () => {
    const savedNotification = { id: 'n1', receiveUser: 'customer-1' } as Notification;
    notificationService.createFromEvent.mockResolvedValue({
      notification: savedNotification,
      created: true,
    });

    await eventBus.publish(ORDER_CREATED_EVENT, {
      orderId: 'order-1',
      customerId: 'customer-1',
      status: 'pending',
      occurredAt: '2026-09-03T00:00:00.000Z',
    });

    expect(notificationService.createFromEvent).toHaveBeenCalledWith({
      recipientUserId: 'customer-1',
      description: 'Đơn hàng đã được tạo',
      content: 'Đơn hàng #order-1 đang được xử lý.',
      type: 'order',
      idempotencyKey: 'ordering.order.created:order-1:customer-1',
    });
  });

  it('consumes Payment and Delivery events through the Ordering recipient port', async () => {
    const savedNotification = { id: 'n2', receiveUser: 'customer-1' } as Notification;
    notificationService.createFromEvent.mockResolvedValue({
      notification: savedNotification,
      created: true,
    });

    await eventBus.publish(PAYMENT_SUCCEEDED_EVENT, {
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      paymentId: 'payment-1',
    });
    await eventBus.publish(DELIVERY_COMPLETED_EVENT, {
      orderId: 'order-1',
      shipperId: 'shipper-1',
      shippingDetailId: 'shipping-1',
      completedAt: '2026-09-03T00:00:00.000Z',
      earnings: 20_000,
      deliveryTimeMinutes: 20,
      onTime: true,
    });

    expect(orderNotificationReader.findNotificationRecipient).toHaveBeenCalledTimes(2);
    expect(notificationService.createFromEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        idempotencyKey: 'payment.succeeded:checkout-1:customer-1',
        type: 'payment',
      }),
    );
    expect(notificationService.createFromEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        idempotencyKey: 'delivery.completed:order-1:customer-1',
        type: 'delivery',
      }),
    );
  });

  it('does not publish a duplicate when an event is replayed', async () => {
    const savedNotification = { id: 'n3', receiveUser: 'customer-1' } as Notification;
    notificationService.createFromEvent
      .mockResolvedValueOnce({ notification: savedNotification, created: true })
      .mockResolvedValueOnce({ notification: savedNotification, created: false });
    const event = {
      idempotencyKey: 'message-1',
      recipientUserId: 'customer-1',
      description: 'Bạn có tin nhắn mới',
      content: 'Xin chào',
      type: 'message',
    };

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, event);
    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, event);

    expect(notificationService.createFromEvent).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).toHaveBeenCalledTimes(1);
  });

  it('retries then records a dead letter without throwing to the source event', async () => {
    notificationService.createFromEvent.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      eventBus.publish(ORDER_CREATED_EVENT, {
        orderId: 'order-1',
        customerId: 'customer-1',
        status: 'pending',
        occurredAt: '2026-09-03T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();

    expect(notificationService.createFromEvent).toHaveBeenCalledTimes(2);
    expect(deadLetterService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ORDER_CREATED_EVENT,
        idempotencyKey: 'ordering.order.created:order-1:customer-1',
        error: 'DB connection lost',
      }),
    );
  });

  it('does not replay persistence when GraphQL publication fails', async () => {
    const savedNotification = { id: 'n4', receiveUser: 'customer-1' } as Notification;
    notificationService.createFromEvent.mockResolvedValue({
      notification: savedNotification,
      created: true,
    });
    (pubSub.publish as jest.Mock).mockRejectedValueOnce(new Error('subscription unavailable'));

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      idempotencyKey: 'notification-1',
      recipientUserId: 'customer-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    expect(notificationService.createFromEvent).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on module destroy', async () => {
    handler.onModuleDestroy();
    await eventBus.publish(ORDER_CREATED_EVENT, {
      orderId: 'order-1',
      customerId: 'customer-1',
      status: 'pending',
      occurredAt: '2026-09-03T00:00:00.000Z',
    });

    expect(notificationService.createFromEvent).not.toHaveBeenCalled();
  });
});
