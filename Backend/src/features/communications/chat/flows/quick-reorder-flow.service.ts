import { Inject, Injectable } from '@nestjs/common';
import { LOCATION_READER, type LocationReaderPort } from 'src/features/locations/public-api';
import { CATALOG_CHAT_READER, type CatalogChatReaderPort } from 'src/features/menu/public-api';
import {
  CHAT_ORDERING,
  type ChatOrderingPort,
  type ChatReorderOrder,
} from 'src/features/orders/public-api';
import { ChatMetadata, ChatReply } from '../types/chat.types';

@Injectable()
export class QuickReorderFlowService {
  constructor(
    @Inject(CHAT_ORDERING)
    private readonly ordering: ChatOrderingPort,
    @Inject(LOCATION_READER)
    private readonly locationReader: LocationReaderPort,
    @Inject(CATALOG_CHAT_READER)
    private readonly catalogReader: CatalogChatReaderPort,
  ) {}

  isStartRequest(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return lowerMessage.includes('đặt lại') || lowerMessage.includes('đơn gần nhất');
  }

  async start(userId: string, metadata: ChatMetadata): Promise<ChatReply> {
    const quickOrders = await this.ordering.getRecentOrdersForReorder(userId, 3);

    if (!quickOrders || quickOrders.length === 0) {
      return {
        reply: 'Bạn chưa có đơn hàng nào gần đây để đặt lại.',
        action: 'noRecentOrder',
        metadata,
      };
    }

    const quickOrdersPreview = quickOrders.map((order, index) => {
      const summary = order.orderDetails
        .map((detail) => `${detail.quantity} ${detail.foodName}`)
        .join(', ');
      return `${index + 1}. ${summary} (Tổng: ${order.totalAmount}₫)`;
    });

    metadata.quickOrderOptions = quickOrders;
    metadata.isQuickReorder = true;

    return {
      reply: `Bạn muốn đặt lại đơn nào? Vui lòng chọn số:\n${quickOrdersPreview.join('\n')}`,
      action: 'chooseQuickOrder',
      metadata,
    };
  }

  async continue(userMessage: string, userId: string, metadata: ChatMetadata): Promise<ChatReply> {
    if (metadata.pendingQuickOrder) {
      if (!this.isPositiveConfirmation(userMessage)) {
        return {
          reply: 'Mình chưa tạo đơn. Bạn hãy trả lời "có" để xác nhận hoặc "hủy" để dừng.',
          action: 'confirmCreateOrder',
          metadata,
        };
      }

      const currentOrder = (await this.ordering.getRecentOrdersForReorder(userId, 3)).find(
        (order) => order.orderId === metadata.pendingQuickOrder?.orderId,
      );
      if (!currentOrder) {
        return {
          reply: 'Đơn đặt lại đã thay đổi hoặc không còn khả dụng. Bạn vui lòng chọn lại đơn.',
          action: 'retryQuickOrder',
          metadata: { ...metadata, pendingQuickOrder: undefined },
        };
      }

      return this.createReorder(currentOrder, userId, metadata);
    }

    const chosenIndex = parseInt(userMessage, 10) - 1;
    const quickOrders = await this.ordering.getRecentOrdersForReorder(userId, 3);

    if (isNaN(chosenIndex) || !quickOrders?.[chosenIndex]) {
      return {
        reply: 'Lựa chọn không hợp lệ. Vui lòng chọn số đơn muốn đặt lại.',
        action: 'retryQuickOrder',
        metadata,
      };
    }

    const selectedOrder = quickOrders[chosenIndex];

    if (!selectedOrder.restaurantId) {
      return {
        reply: 'Không xác định được nhà hàng của đơn hàng này. Không thể đặt lại.',
        action: 'invalidRestaurant',
        metadata: { ...metadata, isQuickReorder: false },
      };
    }

    const fallbackAddressId = (await this.locationReader.listOwnedAddresses(userId))?.[0]
      ?.addressId;
    if (!fallbackAddressId) {
      return {
        reply: 'Bạn chưa có địa chỉ nào để giao hàng. Vui lòng thêm địa chỉ trước.',
        action: 'noAddress',
        metadata: { ...metadata, isQuickReorder: false },
      };
    }

    const validation = await this.revalidateItems(selectedOrder);
    if (validation.error) {
      return {
        reply: validation.error,
        action: 'foodNotFound',
        metadata: { ...metadata, isQuickReorder: false },
      };
    }

    metadata.pendingQuickOrder = selectedOrder;
    return {
      reply: `Bạn đã chọn đặt lại đơn gồm ${selectedOrder.orderDetails
        .map((item) => `${item.quantity} ${item.foodName}`)
        .join(
          ', ',
        )}. Giá và tình trạng món sẽ được kiểm tra lại khi tạo đơn. Bạn có xác nhận không?`,
      action: 'confirmCreateOrder',
      metadata,
    };
  }

  private async createReorder(
    selectedOrder: ChatReorderOrder,
    userId: string,
    metadata: ChatMetadata,
  ): Promise<ChatReply> {
    if (!selectedOrder.restaurantId) {
      return {
        reply: 'Không xác định được nhà hàng của đơn hàng này. Không thể đặt lại.',
        action: 'invalidRestaurant',
        metadata: { ...metadata, isQuickReorder: false, pendingQuickOrder: undefined },
      };
    }

    const fallbackAddressId = (await this.locationReader.listOwnedAddresses(userId))?.[0]
      ?.addressId;
    if (!fallbackAddressId) {
      return {
        reply: 'Bạn chưa có địa chỉ nào để giao hàng. Vui lòng thêm địa chỉ trước.',
        action: 'noAddress',
        metadata: { ...metadata, isQuickReorder: false, pendingQuickOrder: undefined },
      };
    }

    const validation = await this.revalidateItems(selectedOrder);
    if (validation.error) {
      return {
        reply: validation.error,
        action: 'foodNotFound',
        metadata: { ...metadata, isQuickReorder: false, pendingQuickOrder: undefined },
      };
    }

    const newOrder = await this.ordering.createOrder({
      customerId: userId,
      restaurantId: selectedOrder.restaurantId,
      addressId: fallbackAddressId,
      paymentMethod: 'cod',
      items: validation.items,
    });

    return {
      reply: `Đơn hàng của bạn đã được đặt lại thành công!\nXem tại: https://foodee-fe.onrender.com/order/${newOrder.orderId}`,
      action: 'quickOrderCreated',
      metadata: {
        ...metadata,
        isQuickReorder: false,
        pendingQuickOrder: undefined,
        orderId: newOrder.orderId,
      },
    };
  }

  private async revalidateItems(selectedOrder: ChatReorderOrder): Promise<{
    items: Array<{ foodId: string; quantity: number }>;
    error?: string;
  }> {
    const items: Array<{ foodId: string; quantity: number }> = [];
    for (const item of selectedOrder.orderDetails) {
      if (!item.foodId) {
        return {
          items: [],
          error: `Không thể xác định mã món "${item.foodName}" để kiểm tra lại thực đơn.`,
        };
      }

      const food = await this.catalogReader.findAvailableFood(
        item.foodId,
        selectedOrder.restaurantId,
      );
      if (!food) {
        return {
          items: [],
          error: `Không thể tìm thấy món "${item.foodName}" trong thực đơn hiện tại.`,
        };
      }
      items.push({ foodId: food.foodId, quantity: item.quantity });
    }
    return { items };
  }

  private isPositiveConfirmation(userMessage: string): boolean {
    const lowerMessage = userMessage.normalize('NFC').toLowerCase();
    const boundary = '(?:^|[^\\p{L}\\p{N}_])';
    const end = '(?=$|[^\\p{L}\\p{N}_])';
    if (new RegExp(`${boundary}(không|hủy|huỷ|no|cancel)${end}`, 'u').test(lowerMessage)) {
      return false;
    }
    return new RegExp(`${boundary}(có|ok|okay|đồng ý|xác nhận|tiếp tục|yes)${end}`, 'u').test(
      lowerMessage,
    );
  }
}
