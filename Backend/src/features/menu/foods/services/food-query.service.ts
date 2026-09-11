import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Food } from 'src/entities/food.entity';
import {
  type CatalogChatFoodSnapshot,
  type CatalogChatReaderPort,
} from '../../contracts/catalog-chat-reader.port';
import {
  type FoodDiscoveryReaderPort,
  type FoodPreviewSnapshot,
} from '../../contracts/food-discovery-reader.port';
import {
  type FoodReviewTargetReaderPort,
  type FoodReviewTargetSnapshot,
} from '../../contracts/food-review-target-reader.port';
import {
  type GetOrderableItemsRequest,
  type MenuReaderPort,
  type OrderableItemSnapshot,
  type OrderableToppingSnapshot,
} from '../../contracts/menu-reader.port';
import {
  CustomerFoodService,
  FoodPaginationResult,
  FoodQueryItem,
  FoodQueryRestaurant,
  FoodSortType,
} from './customer-food.service';

export {
  CustomerFoodService,
  FoodPaginationResult,
  FoodQueryItem,
  FoodQueryRestaurant,
  FoodSortType,
};

/**
 * Backward compatibility facade combining CustomerFoodService and External Reader Ports.
 * Specialized services:
 * - CustomerFoodService: Customer facing menu and search operations
 * - MerchantFoodService: Merchant food management
 * - AdminFoodService: Admin search and deletion
 * - FoodIntegrationService: Cross-module contract implementations
 */
@Injectable()
export class FoodQueryService
  extends CustomerFoodService
  implements
    FoodDiscoveryReaderPort,
    CatalogChatReaderPort,
    FoodReviewTargetReaderPort,
    MenuReaderPort
{
  /**
   * Search foods for store/admin (compatibility delegator)
   */
  async searchFoodsForStore(
    query: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    restaurantId?: string,
    categoryId?: string,
    sortBy?: FoodSortType,
    radius = 99999,
  ): Promise<FoodPaginationResult> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category');

    if (query && query.trim()) {
      queryBuilder.where(
        '(unaccent(food.name) ILIKE unaccent(:query) OR unaccent(food.description) ILIKE unaccent(:query))',
        { query: `%${query.trim()}%` },
      );
    }

    if (restaurantId) {
      const whereMethod = query && query.trim() ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.restaurant_id = :restaurantId', { restaurantId });
    }

    if (categoryId) {
      const whereMethod = (query && query.trim()) || restaurantId ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.category_id = :categoryId', { categoryId });
    }

    let items = await queryBuilder.getMany();

    if (lat && lng) {
      items = items
        .filter((f) => f.restaurant?.latitude && f.restaurant?.longitude)
        .map((f) => ({
          ...f,
          distance: haversineDistance(
            lat,
            lng,
            Number(f.restaurant.latitude),
            Number(f.restaurant.longitude),
          ),
        }))
        .filter((f) => f.distance <= radius);
    } else {
      items = items.map((f) => ({ ...f, distance: null }));
    }

    items = this.applySorting(items, sortBy, lat, lng);

    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: pagedItems,
      totalItems,
      page,
      pageSize,
      totalPages,
    };
  }

  // --- External Reader Ports Implementation ---

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

  async findFoodReviewTarget(foodId: string): Promise<FoodReviewTargetSnapshot | null> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      select: ['id', 'name'],
    });

    return food ? { foodId: food.id, name: food.name ?? null } : null;
  }

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
