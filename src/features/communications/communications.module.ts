import { Module } from '@nestjs/common';
import { ChatModule } from '../../modules/chat/chat.module';
import { MessengerModule } from '../../modules/messenger/messenger.module';
import { NotificationsModule } from './notifications/notifications.module';

/** Owns chat, messaging and notification slices under Communications. */
@Module({ imports: [ChatModule, MessengerModule, NotificationsModule] })
export class CommunicationsModule {}
