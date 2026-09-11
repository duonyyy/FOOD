import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDeadLetter } from 'src/entities/notification-dead-letter.entity';
import { Notification } from 'src/entities/notification.entity';
import { OrdersModule } from 'src/features/orders/public-api';
import { NotificationController } from './controllers/notification.controller';
import { NotificationResolver } from './controllers/notification.resolver';
import { NotificationEventHandler } from './handlers/notification-event.handler';
import { NotificationDeadLetterService } from './services/notification-dead-letter.service';
import { NotificationService } from './services/notification.service';

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
