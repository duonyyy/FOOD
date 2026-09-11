import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatReply } from './types/chat.types';

interface AuthenticatedRequest {
  user?: {
    id?: string;
  };
}

@Controller('chat')
@ApiBearerAuth('bearer')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard)
  @Post()
  async handleChat(
    @Body() body: ChatRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatReply> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    return this.chatService.generateReply(body.userMessage, userId, body.metadata);
  }
}
