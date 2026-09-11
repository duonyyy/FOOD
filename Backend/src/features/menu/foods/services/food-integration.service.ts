import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Repository } from 'typeorm';
import {
  CatalogChatFoodSnapshot,
  CatalogChatReaderPort,
} from '../../contracts/catalog-chat-reader.port';
import {
  FoodDiscoveryReaderPort,
  FoodPreviewSnapshot,
} from '../../contracts/food-discovery-reader.port';
import {
  FoodReviewTargetReaderPort,
  FoodReviewTargetSnapshot,
} from '../../contracts/food-review-target-reader.port';
import {
  GetOrderableItemsRequest,
  MenuReaderPort,
  OrderableItemSnapshot,
  OrderableToppingSnapshot,
} from '../../contracts/menu-reader.port';

/**
 * Service tích hợp liên module (Inter-module Integration):
 * Cung cấp Snapshot dữ liệu món ăn an toàn cho các Bounded Context khác:
 * - Orders (MenuReaderPort)
 * - AI Chatbot (CatalogChatReaderPort)
 * - Reviews (FoodReviewTargetReaderPort)
 * - Restaurants Exploration (FoodDiscoveryReaderPort)
 */
@Injectable()
export class FoodIntegrationService
  implements
    FoodDiscoveryReaderPort,
    CatalogChatReaderPort,
    FoodReviewTargetReaderPort,
    MenuReaderPort
{
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
  ) {}

  // --- 1. FoodDiscoveryReaderPort (Khám phá món ăn cho Restaurant/Search) ---

  async listRestaurantFoods(
    restaurantId: string,
    page: number,
    pageSize: number,
  ): Promise<FoodPreviewSnapshot[]> {
    const foods = await this.foodRepository.find({
      where: { restaurant: { id: restaurantId }, status: 'available' },
      order: { soldCount: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return foods.map((food) => ({
      foodId: food.id,
      name: food.name ?? null,
      image: food.image ?? null,
      price: food.price == null ? null : Number(food.price),
      rating: food.rating == null ? null : Number(food.rating),
      soldCount: food.soldCount ?? null,
    }));
  }

  // --- 2. CatalogChatReaderPort (Hỗ trợ AI Chatbot gợi ý món ăn) ---

  async listAvailableFoods(): Promise<CatalogChatFoodSnapshot[]> {
    const foods = await this.foodRepository.find({
      where: { status: 'available' },
      relations: ['restaurant'],
      order: { name: 'ASC' },
    });

    return foods.flatMap((food) => this.toChatSnapshot(food));
  }

  async findAvailableFood(
    foodId: string,
    restaurantId?: string,
  ): Promise<CatalogChatFoodSnapshot | null> {
    const food = await this.foodRepository.findOne({
      where: {
        id: foodId,
        status: 'available',
        ...(restaurantId ? { restaurant: { id: restaurantId } } : {}),
      },
      relations: ['restaurant'],
    });

    return food ? (this.toChatSnapshot(food)[0] ?? null) : null;
  }

  private toChatSnapshot(food: Food): CatalogChatFoodSnapshot[] {
    if (!food.restaurant?.id || String(food.restaurant.status) !== 'approved') {
      return [];
    }

    return [
      {
        foodId: food.id,
        restaurantId: food.restaurant.id,
        restaurantName: food.restaurant.name ?? '',
        name: food.name ?? '',
        description: food.description ?? null,
        image: food.image ?? null,
        price: Number(food.price),
      },
    ];
  }

  // --- 3. FoodReviewTargetReaderPort (Kiểm tra món ăn khi khách hàng đánh giá) ---

  async findFoodReviewTarget(foodId: string): Promise<FoodReviewTargetSnapshot | null> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      select: ['id', 'name'],
    });

    return food ? { foodId: food.id, name: food.name ?? null } : null;
  }

  // --- 4. MenuReaderPort (Xác thực thông tin và topping khi tạo đơn hàng) ---

  async getOrderableItems(request: GetOrderableItemsRequest): Promise<OrderableItemSnapshot[]> {
    return Promise.all(
      request.items.map((item) => this.toOrderableSnapshot(item.foodId, item.toppingIds ?? [])),
    );
  }

  private async toOrderableSnapshot(
    foodId: string,
    toppingIds: string[],
  ): Promise<OrderableItemSnapshot> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      relations: ['restaurant', 'toppings'],
    });
    if (!food?.restaurant) throw new NotFoundException(`Food with ID ${foodId} not found`);

    const toppingsById = new Map((food.toppings ?? []).map((topping) => [topping.id, topping]));
    const toppings: OrderableToppingSnapshot[] = toppingIds.map((toppingId) => {
      const topping = toppingsById.get(toppingId);
      if (!topping) {
        throw new BadRequestException(`Topping ${toppingId} is not attached to food ${foodId}`);
      }
      return Object.freeze({
        toppingId: topping.id,
        name: topping.name,
        unitPrice: Number(topping.price),
        isAvailable: topping.isAvailable === true,
      });
    });

    const status = food.status ?? null;
    return Object.freeze({
      foodId: food.id,
      restaurantId: food.restaurant.id,
      name: food.name ?? '',
      unitPrice: Number(food.price),
      discountPercent: Number(food.discountPercent) || 0,
      status,
      isAvailable: status === 'available' && toppings.every((topping) => topping.isAvailable),
      toppings: Object.freeze(toppings),
    });
  }
}
