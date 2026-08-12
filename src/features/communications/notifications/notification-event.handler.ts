import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { pubSub } from 'src/pubsub';
import { NotificationService } from './notification.service';

const MAX_RETRIES = 1;

@Injectable()
export class NotificationEventHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventHandler.name);
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<NotificationRequestedEvent>(
      NOTIFICATION_REQUESTED_EVENT,
      (event) => this.handle(event),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: NotificationRequestedEvent): Promise<void> {
    const notification = await this.persistWithRetry(event);
    if (!notification) {
      return;
    }

    try {
      await pubSub.publish('notificationAdded', {
        notificationAdded: notification,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish notification id=${notification.id} to GraphQL subscriptions`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async persistWithRetry(event: NotificationRequestedEvent) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.notificationService.create({
          recipientUserId: event.recipientUserId,
          description: event.description,
          content: event.content,
          type: event.type,
        });
      } catch (error) {
        lastError = error;

        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `Notification creation failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying: ${String(error)}`,
          );
        }
      }
    }

    // All retries exhausted — log and swallow so the source transaction is not affected
    this.logger.error(
      `Failed to create notification after ${MAX_RETRIES + 1} attempts for recipient=${event.recipientUserId}, type=${event.type}`,
      lastError instanceof Error ? lastError.stack : String(lastError),
    );
    return null;
  }
}
