import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDeadLetter } from 'src/entities/notification-dead-letter.entity';
import { Notification } from 'src/entities/notification.entity';
import { OrdersModule } from 'src/features/orders/public-api';
import { NotificationDeadLetterService } from './notification-dead-letter.service';
import { NotificationEventHandler } from './notification-event.handler';
import { NotificationController } from './notification.controller';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationDeadLetter]),
    JwtModule,
    OrdersModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationDeadLetterService,
    NotificationResolver,
    NotificationEventHandler,
  ],
})
export class NotificationsModule {}
