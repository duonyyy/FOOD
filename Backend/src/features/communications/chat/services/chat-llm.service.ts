import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChatMenuItem, ChatOrderItem, ChatReply } from '../types/chat.types';

interface ParseOrderItemsResponse {
  orderItems?: unknown;
}

const SAFE_CHAT_ACTIONS = new Set([
  'orderItems',
  'confirmOrder',
  'confirmRestaurant',
  'chooseAddress',
  'choosePayment',
  'confirmCreateOrder',
  'retryOrder',
]);

function errorDetails(error: unknown): { message: string; code?: string; status?: number } {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);
  constructor(private readonly configService: ConfigService) {}

  async getGeneralReply(userMessage: string, menuFlat: ChatMenuItem[]): Promise<ChatReply> {
    try {
      const response = await axios.post<ChatReply>(
        `${this.getAiServerUrl()}/api/chat/general-reply`,
        { userMessage, menuFlat },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.getTimeoutMs(),
        },
      );

      return this.sanitizeGeneralReply(response.data, menuFlat);
    } catch (error: unknown) {
      const details = errorDetails(error);
      this.logger.error(`[AI Server Error] ${details.message}`);

      if (details.code === 'ECONNREFUSED' || details.status === 502) {
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
      const response = await axios.post<ParseOrderItemsResponse>(
        `${this.getAiServerUrl()}/api/chat/parse-order-items`,
        { userMessage, menuFlat },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.getTimeoutMs(),
        },
      );

      return this.normalizeOrderItems(response.data.orderItems, menuFlat);
    } catch (error: unknown) {
      const details = errorDetails(error);
      this.logger.error(`[AI Server Error] ${details.message}`);
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

  private normalizeOrderItems(value: unknown, menuFlat: ChatMenuItem[]): ChatOrderItem[] {
    if (!Array.isArray(value)) return [];

    const menuById = new Map(menuFlat.map((item) => [item.id, item]));
    return value.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const item = candidate as Record<string, unknown>;
      const menuItem = typeof item.id === 'string' ? menuById.get(item.id) : undefined;
      const quantity = item.quantity;
      if (!menuItem || !Number.isInteger(quantity) || Number(quantity) <= 0) return [];

      return [
        {
          id: menuItem.id,
          name: menuItem.name,
          quantity: Number(quantity),
          // Price and restaurant identity come from Catalog, never from LLM output.
          price: menuItem.price,
          restaurantId: menuItem.restaurantId,
          restaurantName: menuItem.restaurantName,
        },
      ];
    });
  }

  private sanitizeGeneralReply(value: unknown, menuFlat: ChatMenuItem[]): ChatReply {
    if (!value || typeof value !== 'object') {
      return { reply: 'Mình chưa hiểu yêu cầu. Bạn thử diễn đạt lại giúp mình nhé?' };
    }

    const candidate = value as Record<string, unknown>;
    const reply = typeof candidate.reply === 'string' ? candidate.reply.slice(0, 2000) : '';
    const action =
      typeof candidate.action === 'string' && SAFE_CHAT_ACTIONS.has(candidate.action)
        ? candidate.action
        : undefined;
    const menuById = new Map(menuFlat.map((item) => [item.id, item]));
    const suggestions = Array.isArray(candidate.suggestions)
      ? candidate.suggestions.flatMap((suggestion) => {
          if (!suggestion || typeof suggestion !== 'object') return [];
          const item = suggestion as Record<string, unknown>;
          const menuItem = typeof item.id === 'string' ? menuById.get(item.id) : undefined;
          return menuItem ? [menuItem] : [];
        })
      : undefined;

    return {
      reply: reply || 'Mình chưa hiểu yêu cầu. Bạn thử diễn đạt lại giúp mình nhé?',
      action,
      suggestions,
    };
  }
}
