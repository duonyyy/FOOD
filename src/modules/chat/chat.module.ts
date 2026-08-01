import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AddressModule } from '../address/address.module';
import { FoodModule } from '../food/food.module';
import { OrderModule } from '../order/order.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeneralChatFlowService } from './flows/general-chat-flow.service';
import { OrderConversationFlowService } from './flows/order-conversation-flow.service';
import { QuickReorderFlowService } from './flows/quick-reorder-flow.service';
import { ChatContextService } from './services/chat-context.service';
import { ChatLlmService } from './services/chat-llm.service';
import { ChatOrderValidationService } from './services/chat-order-validation.service';
import { OrderCreatedPublisher } from './services/order-created-publisher.service';

@Module({
  imports: [AuthModule, FoodModule, OrderModule, AddressModule, RestaurantModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatContextService,
    ChatLlmService,
    ChatOrderValidationService,
    OrderCreatedPublisher,
    QuickReorderFlowService,
    OrderConversationFlowService,
    GeneralChatFlowService,
  ],
})
export class ChatModule {}
