import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { WebSocketAuthGuard } from 'src/auth/guards/websocket-auth.guard';
import { GraphqlAuthContext } from 'src/common/auth/authenticated-request';
import { Conversation } from 'src/entities/conversation.entity';
import { Message } from 'src/entities/message.entity';
import { pubSub } from 'src/pubsub';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessengerService } from './messenger.service';

@Resolver()
export class MessengerResolver {
  constructor(private readonly messengerService: MessengerService) {}

  @Mutation(() => Conversation)
  @UseGuards(AuthGuard)
  async createConversation(
    @Args('input') createConversationDto: CreateConversationDto,
    @Context() context: GraphqlAuthContext,
  ): Promise<Conversation> {
    const userId = context.req.user.uid || context.req.user.id;
    return await this.messengerService.createOrGetConversation(userId, createConversationDto);
  }

  @Query(() => [Conversation])
  @UseGuards(AuthGuard)
  async getUserConversations(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 10 }) pageSize: number,
    @Context() context: GraphqlAuthContext,
  ): Promise<Conversation[]> {
    const userId = context.req.user.uid || context.req.user.id;
    const result = await this.messengerService.getUserConversations(userId, page, pageSize);
    return result.items;
  }

  @Query(() => [Message])
  @UseGuards(AuthGuard)
  async getConversationMessages(
    @Args('conversationId') conversationId: string,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
    @Context() context: GraphqlAuthContext,
  ): Promise<Message[]> {
    const userId = context.req.user.uid || context.req.user.id;
    const result = await this.messengerService.getConversationMessages(
      userId,
      conversationId,
      page,
      pageSize,
    );
    return result.items;
  }

  @Mutation(() => Message)
  @UseGuards(AuthGuard)
  async sendMessage(
    @Args('input') sendMessageDto: SendMessageDto,
    @Context() context: GraphqlAuthContext,
  ): Promise<Message> {
    const userId = context.req.user.uid || context.req.user.id;
    const message = await this.messengerService.sendMessage(userId, sendMessageDto);

    await pubSub.publish('messageSent', {
      messageSent: message,
      conversationId: message.conversation.id,
    });

    return message;
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async markMessagesAsRead(
    @Args('conversationId') conversationId: string,
    @Context() context: GraphqlAuthContext,
  ): Promise<boolean> {
    const userId = context.req.user.uid || context.req.user.id;
    await this.messengerService.markMessagesAsRead(userId, conversationId);

    // Publish read receipt to subscribers
    await pubSub.publish('messagesRead', {
      messagesRead: true,
      conversationId: conversationId,
    });

    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async deleteMessage(
    @Args('messageId') messageId: string,
    @Context() context: GraphqlAuthContext,
  ): Promise<boolean> {
    const userId = context.req.user.uid || context.req.user.id;
    await this.messengerService.deleteMessage(userId, messageId);
    return true;
  }

  @Query(() => Int)
  @UseGuards(AuthGuard)
  async getUnreadMessageCount(@Context() context: GraphqlAuthContext): Promise<number> {
    const userId = context.req.user.uid || context.req.user.id;
    return await this.messengerService.getUnreadMessageCount(userId);
  }

  // WebSocket Subscriptions with proper filtering
  @Subscription(() => Message, {
    filter: (payload: { conversationId: string }, variables: { conversationId: string }) => {
      // Match the structure you use in pubSub.publish()
      return payload.conversationId === variables.conversationId;
    },
  })
  @UseGuards(WebSocketAuthGuard)
  messageSent(
    @Args('conversationId') _conversationId: string,
    @Context() _context: GraphqlAuthContext,
  ) {
    return pubSub.asyncIterableIterator('messageSent');
  }

  @Subscription(() => Boolean, {
    filter: (payload: { conversationId: string }, variables: { conversationId: string }) => {
      return payload.conversationId === variables.conversationId;
    },
  })
  @UseGuards(WebSocketAuthGuard)
  messagesRead(
    @Args('conversationId') _conversationId: string,
    @Context() _context: GraphqlAuthContext,
  ) {
    return pubSub.asyncIterableIterator('messagesRead');
  }
}
