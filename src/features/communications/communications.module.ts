import { Module } from '@nestjs/common';
import { ChatModule } from '../../modules/chat/chat.module';
import { MessengerModule } from '../../modules/messenger/messenger.module';
import { NotificationModule } from '../../modules/notification/notification.module';

/** Compatibility shell for chat, message and notification ownership. */
@Module({ imports: [ChatModule, MessengerModule, NotificationModule] })
export class CommunicationsModule {}
