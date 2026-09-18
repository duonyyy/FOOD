import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Repository } from 'typeorm';
import { type CatalogChatFood } from '../../types/catalog-chat.types';
import { type FoodPreview } from '../../types/food-discovery.types';
import {
  type GetOrderableItemsRequest,
  type OrderableMenuItem,
  type OrderableTopping,
} from '../../types/menu.types';

/**
 * Service tích hợp liên module (Inter-module Integration):
 * Cung cấp dữ liệu món ăn tối thiểu, an toàn cho các feature khác:
 * - Orders
 * - AI Chatbot
 * - Reviews
 * - Restaurants exploration
 */
@Injectable()
export class FoodIntegrationService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
  ) {}

  // --- 1. Restaurant discovery (Khám phá món ăn cho Restaurant/Search) ---

  async listRestaurantFoods(
    restaurantId: string,
    page: number,
    pageSize: number,
  ): Promise<FoodPreview[]> {
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

  // --- 2. Catalog chat (Hỗ trợ AI Chatbot gợi ý món ăn) ---

  async listAvailableFoods(): Promise<CatalogChatFood[]> {
    const foods = await this.foodRepository.find({
      where: { status: 'available' },
      relations: ['restaurant'],
      order: { name: 'ASC' },
    });

    return foods.flatMap((food) => this.toCatalogChatFoods(food));
  }

  async findAvailableFood(
    foodId: string,
    restaurantId?: string,
  ): Promise<CatalogChatFood | null> {
    const food = await this.foodRepository.findOne({
      where: {
        id: foodId,
        status: 'available',
        ...(restaurantId ? { restaurant: { id: restaurantId } } : {}),
      },
      relations: ['restaurant'],
    });

    return food ? (this.toCatalogChatFoods(food)[0] ?? null) : null;
  }

  private toCatalogChatFoods(food: Food): CatalogChatFood[] {
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

  // --- 3. Food review target (Kiểm tra món ăn khi khách hàng đánh giá) ---

  async assertFoodExists(foodId: string): Promise<void> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      select: ['id'],
    });
    if (!food) {
      throw new NotFoundException(`Food with id ${foodId} not found`);
    }
  }

  // --- 4. Orderable menu (Xác thực thông tin và topping khi tạo đơn hàng) ---

  async getOrderableItems(request: GetOrderableItemsRequest): Promise<OrderableMenuItem[]> {
    return Promise.all(
      request.items.map((item) => this.toOrderableMenuItem(item.foodId, item.toppingIds ?? [])),
    );
  }

  private async toOrderableMenuItem(
    foodId: string,
    toppingIds: string[],
  ): Promise<OrderableMenuItem> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      relations: ['restaurant', 'toppings'],
    });
    if (!food?.restaurant) throw new NotFoundException(`Food with ID ${foodId} not found`);

    const toppingsById = new Map((food.toppings ?? []).map((topping) => [topping.id, topping]));
    const toppings: OrderableTopping[] = toppingIds.map((toppingId) => {
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
    const restaurantIsApproved = String(food.restaurant.status) === 'approved';
    return Object.freeze({
      foodId: food.id,
      restaurantId: food.restaurant.id,
      name: food.name ?? '',
      unitPrice: Number(food.price),
      discountPercent: Number(food.discountPercent) || 0,
      status,
      isAvailable:
        status === 'available' && restaurantIsApproved && toppings.every((topping) => topping.isAvailable),
      toppings: Object.freeze(toppings),
    });
  }
}
