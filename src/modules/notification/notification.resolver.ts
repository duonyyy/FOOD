import { UseGuards } from '@nestjs/common';
import { Context, Resolver, Subscription } from '@nestjs/graphql';
import { WebSocketAuthGuard } from 'src/auth/guards/websocket-auth.guard';
import { Notification } from 'src/entities/notification.entity';
import { pubSub } from 'src/pubsub';
import { NotificationService } from './notification.service';

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(private notificationService: NotificationService) {}

  @Subscription(() => Notification, {
    filter: (payload, variables, context) =>
      payload.notificationAdded.receiveUser === context.connection.context.user.id,
  })
  @UseGuards(WebSocketAuthGuard)
  notificationAdded(@Context() context: any) {
    return pubSub.asyncIterableIterator('notificationAdded');
  }
}
