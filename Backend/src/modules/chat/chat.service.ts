import { Injectable, Logger } from '@nestjs/common';
import { GeneralChatFlowService } from './flows/general-chat-flow.service';
import { OrderConversationFlowService } from './flows/order-conversation-flow.service';
import { QuickReorderFlowService } from './flows/quick-reorder-flow.service';
import { ChatContextService } from './services/chat-context.service';
import { ChatMetadata, ChatReply } from './types/chat.types';
import { createInitialChatMetadata, normalizeChatMetadata } from './utils/chat-metadata.factory';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    private readonly chatContextService: ChatContextService,
    private readonly quickReorderFlowService: QuickReorderFlowService,
    private readonly orderConversationFlowService: OrderConversationFlowService,
    private readonly generalChatFlowService: GeneralChatFlowService,
  ) {}

  async generateReply(
    userMessage: string,
    userId: string,
    metadata?: Partial<ChatMetadata> | null,
  ): Promise<ChatReply> {
    try {
      const normalizedMessage = String(userMessage || '').trim();
      const chatMetadata = normalizeChatMetadata(metadata);

      if (this.isCancelRequest(normalizedMessage)) {
        return {
          reply: 'Quy trình đã bị hủy. Bạn muốn thực hiện hành động khác không?',
          action: 'cancelOrder',
          metadata: createInitialChatMetadata(),
        };
      }

      if (this.quickReorderFlowService.isStartRequest(normalizedMessage)) {
        return this.quickReorderFlowService.start(userId, chatMetadata);
      }

      if (chatMetadata.isQuickReorder) {
        return this.quickReorderFlowService.continue(normalizedMessage, userId, chatMetadata);
      }

      if (
        this.orderConversationFlowService.isStartRequest(normalizedMessage) &&
        !chatMetadata.isOrdering
      ) {
        return this.orderConversationFlowService.start(chatMetadata);
      }

      const context = await this.chatContextService.getContext(userId);

      if (this.isOrderInProgress(chatMetadata)) {
        return this.orderConversationFlowService.continue(
          normalizedMessage,
          userId,
          chatMetadata,
          context,
        );
      }

      return this.generalChatFlowService.reply(normalizedMessage, context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[ChatService.generateReply] Error: ${message}`);
      throw new Error('Không thể tạo phản hồi từ hệ thống.');
    }
  }

  private isCancelRequest(userMessage: string): boolean {
    return userMessage.toLowerCase() === 'hủy';
  }

  private isOrderInProgress(metadata: ChatMetadata): boolean {
    return (
      metadata.isOrdering ||
      metadata.isFoodConfirmed ||
      metadata.isRestaurantConfirmed ||
      metadata.isAddressConfirmed ||
      metadata.isPaymentConfirmed
    );
  }
}
