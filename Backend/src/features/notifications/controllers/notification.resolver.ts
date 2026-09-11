import { UseGuards } from '@nestjs/common';
import { Context, Resolver, Subscription } from '@nestjs/graphql';
import { Notification } from 'src/entities/notification.entity';
import { WebSocketAuthGuard } from 'src/features/auth/public-api';
import { pubSub } from 'src/pubsub';

interface NotificationSubscriptionPayload {
  notificationAdded: Notification;
}

interface NotificationSubscriptionContext {
  connection: { context: { user: { id: string } } };
}

@Resolver(() => Notification)
export class NotificationResolver {
  @Subscription(() => Notification, {
    filter: (
      payload: NotificationSubscriptionPayload,
      _variables: unknown,
      context: NotificationSubscriptionContext,
    ) => payload.notificationAdded.receiveUser === context.connection.context.user.id,
  })
  @UseGuards(WebSocketAuthGuard)
  notificationAdded(@Context() _context: unknown) {
    return pubSub.asyncIterableIterator('notificationAdded');
  }
}
