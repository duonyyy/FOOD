import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { MessengerModule } from './messenger/messenger.module';

/** Owns chat and direct messaging slices. */
@Module({ imports: [ChatModule, MessengerModule] })
export class CommunicationsModule {}
