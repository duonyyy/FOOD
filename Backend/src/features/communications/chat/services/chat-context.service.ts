import { Injectable } from '@nestjs/common';
import { FoodIntegrationService } from 'src/features/menu/public-api';
import { OrderMessagingService } from 'src/features/orders/public-api';
import { ChatContext, ChatMenuItem } from '../types/chat.types';

@Injectable()
export class ChatContextService {
  constructor(
    private readonly catalogReader: FoodIntegrationService,
    private readonly orderMessaging: OrderMessagingService,
  ) {}

  async getContext(userId: string): Promise<ChatContext> {
    const [menu, orderHistory] = await Promise.all([
      this.catalogReader.listAvailableFoods(),
      this.orderMessaging.getRecentOrdersForReorder(userId, 5),
    ]);

    const orderedFoods =
      orderHistory?.flatMap((order) => order.orderDetails.map((detail) => detail.foodName)) ?? [];

    const menuFlat: ChatMenuItem[] = menu.map((food) => ({
      id: food.foodId,
      name: food.name,
      price: food.price,
      description: food.description ?? undefined,
      image: food.image || 'https://via.placeholder.com/80x80',
      link: `https://foodee-fe.onrender.com/food/${food.foodId}`,
      restaurantId: food.restaurantId,
      restaurantName: food.restaurantName,
    }));

    return { menuFlat, orderedFoods };
  }
}
