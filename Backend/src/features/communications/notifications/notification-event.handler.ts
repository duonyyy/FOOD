import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  DELIVERY_COMPLETED_EVENT,
  type DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  type NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { ORDER_CREATED_EVENT, type OrderCreatedEvent } from 'src/common/events/order-events';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from 'src/common/events/payment-failed.event';
import {
  PAYMENT_SUCCEEDED_EVENT,
  type PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import {
  ORDER_NOTIFICATION_READER,
  type OrderNotificationReaderPort,
} from 'src/features/orders/public-api';
import { pubSub } from 'src/pubsub';
import { NotificationDeadLetterService } from './notification-dead-letter.service';
import { NotificationService } from './notification.service';

const MAX_RETRIES = 1;

interface NotificationEnvelope {
  eventType: string;
  idempotencyKey: string;
  recipientUserId: string;
  description: string;
  content: string;
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationEventHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventHandler.name);
  private readonly unsubscriptions: Array<() => void> = [];

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly notificationService: NotificationService,
    private readonly deadLetterService: NotificationDeadLetterService,
    @Inject(ORDER_NOTIFICATION_READER)
    private readonly orderNotificationReader: OrderNotificationReaderPort,
  ) {}

  onModuleInit(): void {
    this.unsubscriptions.push(
      this.eventBus.subscribe<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, (event) =>
        this.handleRequested(event),
      ),
      this.eventBus.subscribe<OrderCreatedEvent>(ORDER_CREATED_EVENT, (event) =>
        this.handleOrderCreated(event),
      ),
      this.eventBus.subscribe<PaymentSucceededEvent>(PAYMENT_SUCCEEDED_EVENT, (event) =>
        this.handlePaymentSucceeded(event),
      ),
      this.eventBus.subscribe<PaymentFailedEvent>(PAYMENT_FAILED_EVENT, (event) =>
        this.handlePaymentFailed(event),
      ),
      this.eventBus.subscribe<DeliveryCompletedEvent>(DELIVERY_COMPLETED_EVENT, (event) =>
        this.handleDeliveryCompleted(event),
      ),
    );
  }

  onModuleDestroy(): void {
    this.unsubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private async handleRequested(event: NotificationRequestedEvent): Promise<void> {
    await this.handle({
      eventType: NOTIFICATION_REQUESTED_EVENT,
      idempotencyKey: event.idempotencyKey ?? this.hashKey(NOTIFICATION_REQUESTED_EVENT, event),
      recipientUserId: event.recipientUserId,
      description: event.description,
      content: event.content,
      type: event.type,
      payload: { ...event },
    });
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (!event.customerId) {
      this.logger.warn(`notification_skipped event=${ORDER_CREATED_EVENT} order=${event.orderId}`);
      return;
    }
    await this.handle({
      eventType: ORDER_CREATED_EVENT,
      idempotencyKey: `${ORDER_CREATED_EVENT}:${event.orderId}:${event.customerId}`,
      recipientUserId: event.customerId,
      description: 'Đơn hàng đã được tạo',
      content: `Đơn hàng #${event.orderId} đang được xử lý.`,
      type: 'order',
      payload: { ...event },
    });
  }

  private async handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    const recipient = await this.orderNotificationReader.findNotificationRecipient(event.orderId);
    if (!recipient) {
      this.logger.warn(
        `notification_skipped event=${PAYMENT_SUCCEEDED_EVENT} order=${event.orderId}`,
      );
      return;
    }
    await this.handle({
      eventType: PAYMENT_SUCCEEDED_EVENT,
      idempotencyKey: `${PAYMENT_SUCCEEDED_EVENT}:${event.checkoutId}:${recipient.customerId}`,
      recipientUserId: recipient.customerId,
      description: 'Thanh toán thành công',
      content: `Thanh toán cho đơn hàng #${event.orderId} đã thành công.`,
      type: 'payment',
      payload: event,
    });
  }

  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const recipient = await this.orderNotificationReader.findNotificationRecipient(event.orderId);
    if (!recipient) {
      this.logger.warn(`notification_skipped event=${PAYMENT_FAILED_EVENT} order=${event.orderId}`);
      return;
    }
    await this.handle({
      eventType: PAYMENT_FAILED_EVENT,
      idempotencyKey: `${PAYMENT_FAILED_EVENT}:${event.checkoutId}:${recipient.customerId}`,
      recipientUserId: recipient.customerId,
      description: 'Thanh toán chưa thành công',
      content: `Thanh toán cho đơn hàng #${event.orderId} chưa thành công${
        event.reason ? `: ${event.reason}` : '.'
      }`,
      type: 'payment',
      payload: event,
    });
  }

  private async handleDeliveryCompleted(event: DeliveryCompletedEvent): Promise<void> {
    const recipient = await this.orderNotificationReader.findNotificationRecipient(event.orderId);
    if (!recipient) {
      this.logger.warn(
        `notification_skipped event=${DELIVERY_COMPLETED_EVENT} order=${event.orderId}`,
      );
      return;
    }
    await this.handle({
      eventType: DELIVERY_COMPLETED_EVENT,
      idempotencyKey: `${DELIVERY_COMPLETED_EVENT}:${event.orderId}:${recipient.customerId}`,
      recipientUserId: recipient.customerId,
      description: 'Đơn hàng đã hoàn thành',
      content: `Đơn hàng #${event.orderId} đã được giao thành công.`,
      type: 'delivery',
      payload: event,
    });
  }

  private async handle(event: NotificationEnvelope): Promise<void> {
    const persisted = await this.persistWithRetry(event);
    if (!persisted || !persisted.created) return;

    try {
      await pubSub.publish('notificationAdded', { notificationAdded: persisted.notification });
    } catch (error) {
      this.logger.error(
        `notification_realtime_publish_failed key=${event.idempotencyKey}: ${this.errorMessage(error)}`,
      );
    }
  }

  private async persistWithRetry(event: NotificationEnvelope) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.notificationService.createFromEvent({
          recipientUserId: event.recipientUserId,
          description: event.description,
          content: event.content,
          type: event.type,
          idempotencyKey: event.idempotencyKey,
        });
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `notification_retry event=${event.eventType} key=${event.idempotencyKey} attempt=${attempt + 1}/${MAX_RETRIES + 1}: ${this.errorMessage(error)}`,
          );
        }
      }
    }

    const error = this.errorMessage(lastError);
    await this.deadLetterService.record({
      idempotencyKey: event.idempotencyKey,
      eventType: event.eventType,
      recipientUserId: event.recipientUserId,
      payload: event.payload,
      error,
    });
    this.logger.error(
      `notification_dead_letter event=${event.eventType} key=${event.idempotencyKey} attempts=${MAX_RETRIES + 1}: ${error}`,
    );
    // The source aggregate was committed before an outbox event is dispatched.
    // Do not rethrow and accidentally turn a notification failure into a domain failure.
    return null;
  }

  private hashKey(eventType: string, event: NotificationRequestedEvent): string {
    const payload = JSON.stringify({
      recipientUserId: event.recipientUserId,
      description: event.description,
      content: event.content,
      type: event.type,
    });
    return `${eventType}:${createHash('sha256').update(payload).digest('hex')}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
