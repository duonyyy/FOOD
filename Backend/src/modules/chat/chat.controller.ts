import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatReply } from './types/chat.types';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard)
  @Post()
  async handleChat(@Body() body: ChatRequestDto, @Req() req): Promise<ChatReply> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    return this.chatService.generateReply(body.userMessage, userId, body.metadata);
  }
}
