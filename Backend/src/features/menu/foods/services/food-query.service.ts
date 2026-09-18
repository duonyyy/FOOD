import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Food } from 'src/entities/food.entity';
import { type CatalogChatFood } from '../../types/catalog-chat.types';
import { type FoodPreview } from '../../types/food-discovery.types';
import {
  type GetOrderableItemsRequest,
  type OrderableMenuItem,
  type OrderableTopping,
} from '../../types/menu.types';
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
 * Backward compatibility facade combining CustomerFoodService and cross-module snapshots.
 * Specialized services:
 * - CustomerFoodService: Customer facing menu and search operations
 * - MerchantFoodService: Merchant food management
 * - AdminFoodService: Admin search and deletion
 * - FoodIntegrationService: Cross-module contract implementations
 */
@Injectable()
export class FoodQueryService extends CustomerFoodService {
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

  // --- Cross-module snapshot compatibility implementation ---

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
