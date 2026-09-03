import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { LocationsModule } from 'src/features/locations/public-api';
import { MenuModule } from 'src/features/menu/public-api';
import { OrdersModule } from 'src/features/orders/public-api';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeneralChatFlowService } from './flows/general-chat-flow.service';
import { OrderConversationFlowService } from './flows/order-conversation-flow.service';
import { QuickReorderFlowService } from './flows/quick-reorder-flow.service';
import { ChatContextService } from './services/chat-context.service';
import { ChatLlmService } from './services/chat-llm.service';
import { ChatOrderValidationService } from './services/chat-order-validation.service';

@Module({
  imports: [AuthModule, MenuModule, OrdersModule, LocationsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatContextService,
    ChatLlmService,
    ChatOrderValidationService,
    QuickReorderFlowService,
    OrderConversationFlowService,
    GeneralChatFlowService,
  ],
})
export class ChatModule {}
