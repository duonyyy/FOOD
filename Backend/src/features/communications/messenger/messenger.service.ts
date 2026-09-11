import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { Conversation, ConversationType } from 'src/entities/conversation.entity';
import { Message } from 'src/entities/message.entity';
import {
  ORDER_MESSAGING_READER,
  type OrderMessagingReaderPort,
} from 'src/features/orders/public-api';
import { RESTAURANT_READER, type RestaurantReaderPort } from 'src/features/restaurants/public-api';
import {
  IDENTITY_READER,
  type IdentityReaderPort,
  type IdentityUserSnapshot,
} from 'src/features/users/public-api';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @Inject(IDENTITY_READER)
    private readonly identityReader: IdentityReaderPort,
    @Inject(RESTAURANT_READER)
    private readonly restaurantReader: RestaurantReaderPort,
    @Inject(ORDER_MESSAGING_READER)
    private readonly orderMessagingReader: OrderMessagingReaderPort,
    private readonly eventBus: InProcessEventBus,
  ) {}

  /**
   * Create conversation with business logic validation
   */
  async createOrGetConversation(
    userId: string,
    createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    const { participantId, orderId, restaurantId, conversationType } = createConversationDto;

    // Get restaurant and its owner
    if (!restaurantId) {
      throw new BadRequestException('Restaurant ID is required');
    }
    const restaurant = await this.restaurantReader.findRestaurantForMessaging(restaurantId);

    if (!restaurant) {
      throw new BadRequestException('Restaurant not found');
    }

    // For restaurant conversations, use the restaurant owner as participant
    const finalParticipantId = participantId || restaurant.ownerId;
    const finalConversationType = conversationType || ConversationType.CUSTOMER_SHOP;
    const finalOrderId = orderId;
    const finalRestaurantId = restaurantId;

    // Get user and participant
    const [user, participant] = await Promise.all([
      this.identityReader.findIdentityUser(userId),
      this.identityReader.findIdentityUser(finalParticipantId),
    ]);

    if (!user || !participant) {
      throw new BadRequestException('User or participant not found');
    }

    // Validate conversation rules
    if (finalConversationType === ConversationType.CUSTOMER_SHIPPER) {
      if (!finalOrderId) {
        throw new BadRequestException('Order ID is required for shipper conversations');
      }
      await this.validateShipperConversation(userId, finalParticipantId, finalOrderId);
    } else if (finalConversationType === ConversationType.CUSTOMER_SHOP) {
      if (!finalRestaurantId) {
        throw new BadRequestException('Restaurant ID is required for shop conversations');
      }
      await this.validateShopConversation(userId, finalParticipantId, finalRestaurantId);
    }

    // Check if conversation already exists
    const existingConversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(
        '(conversation.participant1_id = :userId AND conversation.participant2_id = :participantId) OR ' +
          '(conversation.participant1_id = :participantId AND conversation.participant2_id = :userId)',
        { userId, participantId: finalParticipantId },
      )
      .andWhere('conversation.conversationType = :conversationType', {
        conversationType: finalConversationType,
      })
      .andWhere(
        finalOrderId ? 'conversation.orderId = :orderId' : 'conversation.orderId IS NULL',
        finalOrderId ? { orderId: finalOrderId } : {},
      )
      .andWhere(
        finalRestaurantId
          ? 'conversation.restaurantId = :restaurantId'
          : 'conversation.restaurantId IS NULL',
        finalRestaurantId ? { restaurantId: finalRestaurantId } : {},
      )
      .getOne();

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = new Conversation();
    conversation.participant1 = this.userReference(user.userId);
    conversation.participant2 = this.userReference(participant.userId);
    conversation.conversationType = finalConversationType;

    // Fix: Use undefined instead of null for optional fields
    conversation.orderId = finalOrderId || undefined;
    conversation.restaurantId = finalRestaurantId || undefined;

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Validate shipper conversation rules
   */
  private async validateShipperConversation(
    userId: string,
    shipperId: string,
    orderId: string,
  ): Promise<void> {
    if (!orderId) {
      throw new BadRequestException('Order ID is required for shipper conversations');
    }

    // Check if order exists and belongs to the user
    const order = await this.orderMessagingReader.findOrderForMessaging(orderId);

    if (!order || order.customerId !== userId) {
      throw new NotFoundException('Order not found or does not belong to you');
    }

    // Check if order has been assigned to the shipper
    if (order.shipperId !== shipperId) {
      throw new ForbiddenException('You can only chat with the shipper assigned to your order');
    }

    // Check if order is in a state where communication is allowed
    const allowedStatuses = ['confirmed', 'delivering', 'completed'];
    if (!allowedStatuses.includes(order.status)) {
      throw new ForbiddenException(
        'You can only chat with shipper when order is confirmed or being delivered',
      );
    }
  }

  /**
   * Validate shop conversation rules
   */
  private async validateShopConversation(
    userId: string,
    shopOwnerId: string,
    restaurantId: string,
  ): Promise<void> {
    if (!restaurantId) {
      throw new BadRequestException('Restaurant ID is required for shop conversations');
    }

    // Check if restaurant exists and belongs to the shop owner
    const restaurant = await this.restaurantReader.findRestaurantForMessaging(restaurantId);

    if (!restaurant || restaurant.ownerId !== shopOwnerId) {
      throw new NotFoundException('Restaurant not found or does not belong to the shop owner');
    }

    // Customers can always chat with shop owners about their restaurants
    // No additional validation needed
  }

  /**
   * Get available chat partners for a user
   */
  async getAvailableChatPartners(userId: string): Promise<{
    shopOwners: { user: MessagingParticipant; restaurant: { id: string; name: string } }[];
    shippers: { user: MessagingParticipant; order: { id: string; status: string } }[];
  }> {
    const user = await this.identityReader.findIdentityUser(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get shop owners from restaurants (any restaurant the user might want to contact)
    const [restaurants, orders] = await Promise.all([
      this.restaurantReader.listActiveRestaurantsForMessaging(),
      this.orderMessagingReader.listCustomerShipperChatPartners(userId),
    ]);

    // Get shippers from user's orders that are assigned and in progress
    const partners = await this.identityReader.findIdentityUsers([
      ...restaurants.map((restaurant) => restaurant.ownerId),
      ...orders.flatMap((order) => (order.shipperId ? [order.shipperId] : [])),
    ]);
    const partnersById = new Map(partners.map((partner) => [partner.userId, partner]));

    return {
      shopOwners: restaurants.flatMap((restaurant) => {
        const owner = partnersById.get(restaurant.ownerId);
        return owner
          ? [
              {
                user: this.toMessagingParticipant(owner),
                restaurant: { id: restaurant.restaurantId, name: restaurant.name },
              },
            ]
          : [];
      }),
      shippers: orders.flatMap((order) => {
        const shipper = order.shipperId ? partnersById.get(order.shipperId) : null;
        return shipper
          ? [
              {
                user: this.toMessagingParticipant(shipper),
                order: { id: order.orderId, status: order.status },
              },
            ]
          : [];
      }),
    };
  }

  /**
   * Send a message with additional validation
   */
  async sendMessage(userId: string, sendMessageDto: SendMessageDto): Promise<Message> {
    const {
      conversationId,
      content,
      messageType = 'text',
      attachmentUrl,
      attachmentType,
      replyToMessageId,
      metadata,
    } = sendMessageDto;

    // Find conversation and verify user is a participant
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participant1', 'participant2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is a participant in this conversation
    if (conversation.participant1.id !== userId && conversation.participant2.id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Additional validation for shipper conversations
    if (
      conversation.conversationType === ConversationType.CUSTOMER_SHIPPER &&
      conversation.orderId
    ) {
      const order = await this.orderMessagingReader.findOrderForMessaging(conversation.orderId);

      if (order && !['confirmed', 'delivering', 'completed'].includes(order.status)) {
        throw new ForbiddenException('Cannot send messages for orders that are not active');
      }
    }

    // Check if conversation is blocked
    if (conversation.isBlocked) {
      throw new ForbiddenException('This conversation is blocked');
    }

    // Find sender
    const sender = await this.identityReader.findIdentityUser(userId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    // Validate reply message if provided
    if (replyToMessageId) {
      const replyMessage = await this.messageRepository.findOne({
        where: { id: replyToMessageId, conversation: { id: conversationId } },
      });
      if (!replyMessage) {
        throw new NotFoundException('Reply message not found in this conversation');
      }
    }

    // Create message
    const message = this.messageRepository.create({
      conversation,
      sender: this.userReference(sender.userId),
      content,
      messageType,
      attachmentUrl,
      attachmentType,
      replyToMessageId,
      metadata,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's last message info
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    await this.conversationRepository.save(conversation);

    // Publish message event for real-time updates
    this.logger.debug('Publishing message to channel messageSent', {
      id: savedMessage.id,
      conversationId: savedMessage.conversation.id,
      text: savedMessage.content.substring(0, 20), // For privacy, just show the start
    });

    await pubSub.publish('messageSent', {
      messageSent: savedMessage,
      conversationId: savedMessage.conversation.id,
    });

    // Find the receiver (the other participant)
    const receiverId =
      conversation.participant1.id === userId
        ? conversation.participant2.id
        : conversation.participant1.id;

    // Publish notification event — Communications owns persistence
    await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
      idempotencyKey: `Message:${savedMessage.id}:notification`,
      recipientUserId: receiverId,
      description: 'Bạn có tin nhắn mới',
      content: message.content,
      type: 'message',
    });

    return savedMessage;
  }

  /**
   * Get user's conversations with pagination
   */
  async getUserConversations(
    userId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{
    items: Conversation[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [conversations, totalItems] = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participant1', 'participant1')
      .leftJoinAndSelect('conversation.participant2', 'participant2')
      .where('conversation.participant1_id = :userId OR conversation.participant2_id = :userId', {
        userId,
      })
      .orderBy('conversation.lastMessageAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: conversations,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getConversationMessages(
    userId: string,
    conversationId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: Message[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Verify user is a participant in this conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participant1', 'participant2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1.id !== userId && conversation.participant2.id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const [messages, totalItems] = await this.messageRepository.findAndCount({
      where: {
        conversation: { id: conversationId },
        isDeleted: false,
      },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: messages.reverse(), // Reverse to show oldest first
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(userId: string, conversationId: string): Promise<void> {
    // Verify user is a participant
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participant1', 'participant2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1.id !== userId && conversation.participant2.id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Mark all unread messages from other participants as read
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true, readAt: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    // Publish read receipt event
    this.logger.debug(`Publishing read receipt for conversation: ${conversationId}`);
    await pubSub.publish('messagesRead', {
      messagesRead: true,
      conversationId: conversationId,
    });
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only allow sender to delete their own messages
    if (message.sender.id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await this.messageRepository.save(message);
  }

  /**
   * Block/Unblock a conversation
   */
  async toggleBlockConversation(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participant1', 'participant2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1.id !== userId && conversation.participant2.id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (conversation.isBlocked) {
      // Unblock if currently blocked by this user
      if (conversation.blockedBy === userId) {
        conversation.isBlocked = false;
        conversation.blockedBy = '';
      } else {
        throw new ForbiddenException('Conversation was blocked by another user');
      }
    } else {
      // Block conversation
      conversation.isBlocked = true;
      conversation.blockedBy = userId;
    }

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Get unread message count for user
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    const count = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('(conversation.participant1_id = :userId OR conversation.participant2_id = :userId)', {
        userId,
      })
      .andWhere('message.sender_id != :userId', { userId })
      .andWhere('message.isRead = false')
      .andWhere('message.isDeleted = false')
      .getCount();

    return count;
  }

  private userReference(userId: string): Conversation['participant1'] {
    return { id: userId } as Conversation['participant1'];
  }

  private toMessagingParticipant(user: IdentityUserSnapshot): MessagingParticipant {
    return {
      id: user.userId,
      username: user.username,
      name: user.name,
      roleName: user.roleName,
    };
  }
}

export interface MessagingParticipant {
  id: string;
  username: string;
  name: string | null;
  roleName: string | null;
}
