import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChatMenuItem, ChatOrderItem, ChatReply } from '../types/chat.types';

@Injectable()
export class ChatLlmService {
  constructor(private readonly configService: ConfigService) {}

  async getGeneralReply(userMessage: string, menuFlat: ChatMenuItem[]): Promise<ChatReply> {
    try {
      const response = await axios.post(
        `${this.getAiServerUrl()}/api/chat/general-reply`,
        { userMessage, menuFlat },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.getTimeoutMs(),
        },
      );

      return response.data;
    } catch (error: any) {
      console.error('[AI Server Error]', error.message);

      if (error.code === 'ECONNREFUSED' || error.response?.status === 502) {
        return {
          reply: 'Không kết nối được với AI Server. Vui lòng kiểm tra AI Server đang chạy chưa.',
          action: undefined,
        };
      }

      return {
        reply: 'Xin lỗi, hệ thống đang bận. Bạn thử lại sau vài giây nhé?',
        action: undefined,
      };
    }
  }

  async parseOrderItems(userMessage: string, menuFlat: ChatMenuItem[]): Promise<ChatOrderItem[]> {
    try {
      const response = await axios.post(
        `${this.getAiServerUrl()}/api/chat/parse-order-items`,
        { userMessage, menuFlat },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.getTimeoutMs(),
        },
      );

      return response.data.orderItems || [];
    } catch (error: any) {
      console.error('[AI Server Error]', error.message);
      return [];
    }
  }

  private getAiServerUrl(): string {
    return (this.configService.get<string>('AI_SERVER_URL') || 'http://localhost:8000').replace(
      /\/$/,
      '',
    );
  }

  private getTimeoutMs(): number {
    return Number(this.configService.get<string>('AI_SERVER_TIMEOUT_MS') || 10000);
  }
}
