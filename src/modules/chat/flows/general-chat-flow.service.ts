import { Injectable } from '@nestjs/common';
import { ChatLlmService } from '../services/chat-llm.service';
import { ChatContext, ChatReply } from '../types/chat.types';

@Injectable()
export class GeneralChatFlowService {
  constructor(
    private readonly llmService: ChatLlmService,
  ) {}

  async reply(userMessage: string, context: ChatContext): Promise<ChatReply> {
    return this.llmService.getGeneralReply(userMessage, context.menuFlat);
  }
}
