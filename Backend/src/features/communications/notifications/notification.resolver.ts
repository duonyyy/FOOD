import { UseGuards } from '@nestjs/common';
import { Context, Resolver, Subscription } from '@nestjs/graphql';
import { WebSocketAuthGuard } from 'src/auth/guards/websocket-auth.guard';
import { Notification } from 'src/entities/notification.entity';
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
