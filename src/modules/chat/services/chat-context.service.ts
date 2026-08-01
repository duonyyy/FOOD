import { Injectable } from '@nestjs/common';
import { FoodService } from 'src/modules/food/food.service';
import { OrderService } from 'src/modules/order/order.service';
import { ChatContext, ChatMenuItem } from '../types/chat.types';

@Injectable()
export class ChatContextService {
  constructor(
    private readonly foodService: FoodService,
    private readonly orderService: OrderService,
  ) {}

  async getContext(userId: string): Promise<ChatContext> {
    const [menu, orderHistory] = await Promise.all([
      this.foodService.getMenuForUser(userId),
      this.orderService.getOrderHistory(userId, 1, 5),
    ]);

    const orderedFoods =
      orderHistory?.items?.flatMap((order) =>
        order.orderDetails.map((detail) => detail.foodName),
      ) ?? [];

    const menuFlat: ChatMenuItem[] =
      menu?.flatMap((restaurant) =>
        restaurant.foods.map((food) => ({
          id: food.id,
          name: food.name,
          price: food.price,
          description: food.description,
          image: food.image || 'https://via.placeholder.com/80x80',
          link: `https://foodee-fe.onrender.com/food/${food.id}`,
          restaurantId: food.restaurantId,
        })),
      ) ?? [];

    return { menuFlat, orderedFoods };
  }
}
