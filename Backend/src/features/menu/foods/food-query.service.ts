import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import {
  MERCHANT_CATALOG,
  type MerchantCatalogPort,
} from 'src/features/restaurants/merchant-catalog.public-api';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { ROUTE_PORT, type RoutePort } from 'src/infra/contracts/route.port';
import { buildMenuCacheKey, MENU_CACHE_TTL_SECONDS } from '../contracts/menu-cache.policy';

import { Repository, type SelectQueryBuilder } from 'typeorm';

type FoodSortType =
  | 'newest'
  | 'nearby'
  | 'hot'
  | 'most_review'
  | 'most_buy'
  | 'rating'
  | 'price'
  | 'name';

type FoodQueryRestaurant = {
  id?: string;
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  distance?: number | null;
  deliveryTime?: number | null;
  [key: string]: unknown;
};

export interface FoodQueryItem {
  id?: string;
  name?: string;
  description?: string;
  image?: string;
  price?: number;
  rating?: number | null;
  soldCount?: number;
  purchasedNumber?: number;
  createdAt?: Date;
  restaurantId?: string;
  restaurant?: FoodQueryRestaurant | null;
  distance?: number | null;
  reviews?: unknown[];
  totalReviews?: number;
  toppings?: unknown[];
  reviewInfo?: unknown;
}

interface FoodReviewStats {
  total_reviews: string;
  average_rating: string | null;
}

@Injectable()
export class FoodQueryService {
  private readonly logger = new Logger(FoodQueryService.name);

  constructor(
    @InjectRepository(Food)
    private foodRepository: Repository<Food>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Topping)
    private toppingRepository: Repository<Topping>,
    @Inject(MERCHANT_CATALOG)
    private readonly merchantCatalog: MerchantCatalogPort,
    @Inject(CACHE_PORT)
    private readonly cacheService: CachePort,
    @Inject(ROUTE_PORT)
    private readonly routeService: RoutePort,
  ) {}

  private async requireRestaurant(restaurantId: string) {
    const restaurant = await this.merchantCatalog.findRestaurant(restaurantId);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
    }
    return restaurant;
  }

  /**
   * Get top foods by sold count for a restaurant
   */
  async getTopFoodsByRestaurant(restaurantId: string, limit = 5): Promise<object[]> {
    const cacheKey = buildMenuCacheKey('food:topByRestaurant', { restaurantId, limit });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const foods = await this.foodRepository.find({
        where: {
          restaurant: { id: restaurantId },
          status: 'available', // Add status filter
        },
        order: { soldCount: 'DESC' },
        take: limit,
      });

      // Optionally, calculate revenue for each food
      return foods.map((food) => ({
        id: food.id,
        name: food.name,
        image: food.image,
        soldCount: food.soldCount,
        revenue: food.soldCount * food.price,
      }));
    });
  }
  /**
   * Get all foods with pagination
   */
  async findAll(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildMenuCacheKey('food:findAll', {
      page,
      pageSize,
      lat,
      lng,
      status,
      sortBy,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoinAndSelect('food.restaurant', 'restaurant')
        .leftJoinAndSelect('food.category', 'category');

      // Add status filter if provided
      if (status) {
        queryBuilder.where('food.status = :status', { status });
      }

      // Apply sorting using helper
      this.applySortingToQueryBuilder(queryBuilder, sortBy);

      queryBuilder.skip((page - 1) * pageSize).take(pageSize);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      let itemsWithDistance = items.map((food) => {
        let distance: number | null = null;
        if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
          distance = haversineDistance(
            lat,
            lng,
            Number(food.restaurant.latitude),
            Number(food.restaurant.longitude),
          );
        }
        return { ...food, distance };
      });

      // Apply post-query sorting if needed (for distance-based sorts)
      if (sortBy === 'nearby' && lat && lng) {
        itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
      }

      return {
        items: itemsWithDistance,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  /**
   * Search foods for store/admin with additional filtering options
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
    radius = 99999, // Large radius for admin search
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    this.logger.debug('=== searchFoodsForStore Debug ===');
    this.logger.debug('Input parameters:', {
      query,
      page,
      pageSize,
      lat,
      lng,
      restaurantId,
      categoryId,
      sortBy,
      radius,
    });

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category');

    // Add search condition - FIXED
    if (query && query.trim()) {
      queryBuilder.where(
        '(unaccent(food.name) ILIKE unaccent(:query) OR unaccent(food.description) ILIKE unaccent(:query))',
        { query: `%${query.trim()}%` },
      );
      this.logger.debug(`Added search filter (accent-insensitive): ${query.trim()}`);
    }

    // Add restaurant filter if provided
    if (restaurantId) {
      const whereMethod = query && query.trim() ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.restaurant_id = :restaurantId', { restaurantId });
      this.logger.debug(`Added restaurant filter: ${restaurantId}`);
    }

    // Add category filter if provided
    if (categoryId) {
      const whereMethod = (query && query.trim()) || restaurantId ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.category_id = :categoryId', { categoryId });
      this.logger.debug(`Added category filter: ${categoryId}`);
    }

    this.logger.debug(`Query SQL: ${queryBuilder.getQuery()}`);
    this.logger.debug(`Query parameters: ${JSON.stringify(queryBuilder.getParameters())}`);

    // Get all matching items first (don't apply DB sorting for distance-based sorts)
    let items = await queryBuilder.getMany();
    this.logger.debug(`Raw items found: ${items.length}`);

    if (items.length > 0) {
      this.logger.debug('First item example:', {
        id: items[0].id,
        name: items[0].name,
        restaurant: items[0].restaurant?.name,
        category: items[0].category?.name,
      });
    }

    // Add distance and apply location filtering if coordinates provided
    if (lat && lng) {
      this.logger.debug('Applying distance filtering...');
      const beforeFilter = items.length;

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

      this.logger.debug(`Distance filter: ${beforeFilter} -> ${items.length} (within ${radius}km)`);
    } else {
      // Add null distance for consistency
      items = items.map((f) => ({ ...f, distance: null }));
    }

    // Apply sorting using helper
    items = this.applySorting(items, sortBy, lat, lng);

    // Calculate pagination
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

    this.logger.debug('Final result:', {
      totalItems,
      pagedItemsCount: pagedItems.length,
      page,
      totalPages,
    });
    this.logger.debug('=== End searchFoodsForStore Debug ===');

    return {
      items: pagedItems,
      totalItems,
      page,
      pageSize,
      totalPages,
    };
  }
  /**
   * Get foods by restaurant ID and category ID with pagination
   * @param restaurantId The restaurant ID
   * @param categoryId The category ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @param lat Latitude for distance calculation
   * @param lng Longitude for distance calculation
   * @param status Status filter (available, hidden, etc.)
   */
  async findByRestaurantAndCategory(
    restaurantId: string,
    categoryId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildMenuCacheKey('food:byRestaurantAndCategory', {
      restaurantId,
      categoryId,
      page,
      pageSize,
      lat,
      lng,
      status,
      sortBy,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      await this.requireRestaurant(restaurantId);

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoinAndSelect('food.restaurant', 'restaurant')
        .leftJoinAndSelect('food.category', 'category')
        .where('food.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('food.category_id = :categoryId', { categoryId });

      // Add status filter if provided
      if (status) {
        queryBuilder.andWhere('food.status = :status', { status });
      }

      // Apply sorting using helper
      this.applySortingToQueryBuilder(queryBuilder, sortBy);

      queryBuilder.skip((page - 1) * pageSize).take(pageSize);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      let itemsWithDistance = items.map((food) => {
        let distance: number | null = null;
        if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
          distance = haversineDistance(
            lat,
            lng,
            Number(food.restaurant.latitude),
            Number(food.restaurant.longitude),
          );
        }
        return { ...food, distance };
      });

      // Apply post-query sorting if needed (for distance-based sorts)
      if (sortBy === 'nearby' && lat && lng) {
        itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
      }

      return {
        items: itemsWithDistance,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  /**
   * Get foods by restaurant ID with pagination
   *
   * @param restaurantId The restaurant ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of foods for a specific restaurant with pagination metadata
   */
  async findByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildMenuCacheKey('food:byRestaurant', {
      restaurantId,
      page,
      pageSize,
      lat,
      lng,
      status,
      sortBy,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const restaurant = await this.requireRestaurant(restaurantId);

      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoinAndSelect('food.category', 'category')
        .where('food.restaurant_id = :restaurantId', { restaurantId });

      // Add status filter if provided
      if (status) {
        queryBuilder.andWhere('food.status = :status', { status });
      }

      // Apply sorting using helper
      this.applySortingToQueryBuilder(queryBuilder, sortBy);

      queryBuilder.skip((page - 1) * pageSize).take(pageSize);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      let itemsWithDistance = items.map((food) => {
        let distance: number | null = null;
        if (lat && lng && restaurant.latitude && restaurant.longitude) {
          distance = haversineDistance(
            lat,
            lng,
            Number(restaurant.latitude),
            Number(restaurant.longitude),
          );
        }
        return { ...food, distance };
      });

      // Apply post-query sorting if needed (for distance-based sorts)
      if (sortBy === 'nearby' && lat && lng) {
        itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
      }

      return {
        items: itemsWithDistance,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  /**
   * Get foods by category ID with pagination
   *
   * @param categoryId The category ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of foods for a specific category with pagination metadata
   */
  async findByCategory(
    categoryId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    sortBy?: FoodSortType,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildMenuCacheKey('food:byCategory', {
      categoryId,
      page,
      pageSize,
      lat,
      lng,
      sortBy,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoinAndSelect('food.restaurant', 'restaurant')
        .leftJoinAndSelect('food.category', 'category')
        .where('food.category_id = :categoryId', { categoryId });

      // Apply sorting using helper
      this.applySortingToQueryBuilder(queryBuilder, sortBy);

      queryBuilder.skip((page - 1) * pageSize).take(pageSize);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      let itemsWithDistance = items.map((food) => {
        let distance: number | null = null;
        if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
          distance = haversineDistance(
            lat,
            lng,
            Number(food.restaurant.latitude),
            Number(food.restaurant.longitude),
          );
        }
        return { ...food, distance };
      });

      // Apply post-query sorting if needed (for distance-based sorts)
      if (sortBy === 'nearby' && lat && lng) {
        itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
      }

      return {
        items: itemsWithDistance,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  /**
   * Get top selling foods with pagination
   *
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of top selling foods with pagination metadata
   */
  async findTopSelling(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [items, totalItems] = await this.foodRepository.findAndCount({
      order: {
        purchasedNumber: 'DESC',
      },
      relations: ['restaurant', 'category'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(food.restaurant.latitude),
          Number(food.restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get newest foods with pagination
   *
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of newest foods with pagination metadata
   */
  async findNewest(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [items, totalItems] = await this.foodRepository.findAndCount({
      relations: ['restaurant', 'category'],
      order: {
        id: 'DESC', // Assuming UUIDs are chronological
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(food.restaurant.latitude),
          Number(food.restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get top selling foods by restaurant with pagination
   *
   * @param restaurantId The restaurant ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of top selling foods for a specific restaurant with pagination metadata
   */
  async findTopSellingByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const restaurant = await this.requireRestaurant(restaurantId);

    const [items, totalItems] = await this.foodRepository.findAndCount({
      where: { restaurant: { id: restaurantId } },
      relations: ['category'],
      order: {
        purchasedNumber: 'DESC',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && restaurant.latitude && restaurant.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(restaurant.latitude),
          Number(restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get foods by category and restaurant with pagination
   *
   * @param categoryId The category ID
   * @param restaurantId The restaurant ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of foods for a specific category and restaurant with pagination metadata
   */
  async findByCategoryAndRestaurant(
    categoryId: string,
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const restaurant = await this.requireRestaurant(restaurantId);

    const [items, totalItems] = await this.foodRepository.findAndCount({
      where: {
        category: { id: categoryId },
        restaurant: { id: restaurantId },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && restaurant.latitude && restaurant.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(restaurant.latitude),
          Number(restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get foods with discount with pagination
   *
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of foods with discount with pagination metadata
   */
  async findWithDiscount(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .where('food.discountPercent IS NOT NULL')
      .andWhere('food.discountPercent != :zero', { zero: '0' })
      .orderBy('CAST(food.discountPercent AS DECIMAL)', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const totalItems = await queryBuilder.getCount();
    const items = await queryBuilder.getMany();

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(food.restaurant.latitude),
          Number(food.restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Get foods with discount by restaurant with pagination
   *
   * @param restaurantId The restaurant ID
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of foods with discount for a specific restaurant with pagination metadata
   */
  async findWithDiscountByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const restaurant = await this.requireRestaurant(restaurantId);

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.discountPercent IS NOT NULL')
      .andWhere('food.discountPercent != :zero', { zero: '0' })
      .orderBy('CAST(food.discountPercent AS DECIMAL)', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const totalItems = await queryBuilder.getCount();
    const items = await queryBuilder.getMany();

    const itemsWithDistance = items.map((food) => {
      let distance: number | null = null;
      if (lat && lng && restaurant.latitude && restaurant.longitude) {
        distance = haversineDistance(
          lat,
          lng,
          Number(restaurant.latitude),
          Number(restaurant.longitude),
        );
      }
      return { ...food, distance };
    });

    return {
      items: itemsWithDistance,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async searchFoods(
    query: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    radius = 5,
  ): Promise<object> {
    this.logger.debug('=== searchFoods Debug ===');
    this.logger.debug('Input parameters:', {
      query,
      page,
      pageSize,
      lat,
      lng,
      radius,
    });

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category');

    // Add search condition - FIXED
    if (query && query.trim()) {
      queryBuilder.where(
        '(unaccent(food.name) ILIKE unaccent(:query) OR unaccent(food.description) ILIKE unaccent(:query))',
        { query: `%${query.trim()}%` },
      );
      this.logger.debug(`Added search filter (accent-insensitive): ${query}`);
    } else {
      this.logger.debug('No search query provided, returning all foods');
    }

    this.logger.debug(`Query SQL: ${queryBuilder.getQuery()}`);
    this.logger.debug(`Query parameters: ${JSON.stringify(queryBuilder.getParameters())}`);

    // Get all matching items first
    let items = await queryBuilder.getMany();
    this.logger.debug(`Raw items found: ${items.length}`);

    if (items.length > 0) {
      this.logger.debug('First item example:', {
        id: items[0].id,
        name: items[0].name,
        restaurant: items[0].restaurant?.name,
      });
    }

    // Add distance and apply location filtering if coordinates provided
    if (lat && lng) {
      this.logger.debug('Applying distance filtering...');
      const beforeFilter = items.length;

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
        .filter((f) => f.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      this.logger.debug(`Distance filter: ${beforeFilter} -> ${items.length} (within ${radius}km)`);

      if (items.length > 0) {
        this.logger.debug(
          'Distance examples:',
          items.slice(0, 3).map((f) => ({
            name: f.name,
            distance: haversineDistance(
              lat,
              lng,
              Number(f.restaurant.latitude),
              Number(f.restaurant.longitude),
            ),
          })),
        );
      }
    } else {
      // Add null distance for consistency
      items = items.map((f) => ({ ...f, distance: null }));
    }

    // Calculate pagination
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

    this.logger.debug('Final result:', {
      totalItems,
      pagedItemsCount: pagedItems.length,
      page,
      totalPages,
    });
    this.logger.debug('=== End searchFoods Debug ===');

    return {
      items: pagedItems,
      totalItems,
      page,
      pageSize,
      totalPages,
    };
  }
  /**
   * Get a specific food by ID
   *
   * @param id The food ID
   * @returns The food details
   */
  async findOne(id: string, lat?: number, lng?: number): Promise<FoodQueryItem> {
    this.logger.debug('=== findOne Debug ===');
    this.logger.debug(`Looking for food with ID: ${id}`);

    // First get the food with basic relations
    const food = await this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('restaurant.address', 'address')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('food.toppings', 'toppings')
      .where('food.id = :id', { id })
      .getOne();

    if (!food) {
      throw new NotFoundException(`Food with ID ${id} not found`);
    }

    // Separately get the top 3 reviews for this food
    const topReviews = await this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.reviews', 'reviews')
      .leftJoinAndSelect('reviews.user', 'reviewUser')
      .where('food.id = :id', { id })
      .andWhere('reviews.type = :type', { type: 'food' })
      .andWhere('reviews.rating IS NOT NULL')
      .orderBy('reviews.rating', 'DESC')
      .addOrderBy('reviews.createdAt', 'DESC')
      .limit(3)
      .getOne();

    // Get all reviews count for statistics
    const allReviewsData = await this.foodRepository
      .createQueryBuilder('food')
      .leftJoin('food.reviews', 'allReviews')
      .select(['COUNT(allReviews.id) as total_reviews', 'AVG(allReviews.rating) as average_rating'])
      .where('food.id = :id', { id })
      .andWhere('allReviews.type = :type', { type: 'food' })
      .andWhere('allReviews.rating IS NOT NULL')
      .getRawOne<FoodReviewStats>();

    this.logger.debug(`Food found: ${food.id} ${food.name}`);
    this.logger.debug(`Top 3 reviews found: ${topReviews?.reviews?.length || 0}`);
    this.logger.debug(`Total reviews stats: ${JSON.stringify(allReviewsData)}`);

    // Calculate statistics
    const totalReviews = parseInt(allReviewsData?.total_reviews || '0', 10);
    const averageRating = allReviewsData?.average_rating
      ? Number(parseFloat(allReviewsData.average_rating).toFixed(1))
      : null;

    this.logger.debug(`Calculated stats - Total: ${totalReviews}, Average: ${averageRating}`);

    // Prepare clean result
    const result: FoodQueryItem = {
      ...food,
      rating: averageRating,
      totalReviews,
      toppings: food.toppings
        ? food.toppings.map((topping) => ({
            id: topping.id,
            name: topping.name,
            price: topping.price,
            isAvailable: topping.isAvailable,
            isFree: topping.price < 1,
          }))
        : [],
      restaurant: food.restaurant
        ? {
            id: food.restaurant.id,
            name: food.restaurant.name,
            description: food.restaurant.description,
            avatar: food.restaurant.avatar,
            backgroundImage: food.restaurant.backgroundImage,
            phoneNumber: food.restaurant.phoneNumber,
            status: food.restaurant.status,
            latitude: food.restaurant.latitude,
            longitude: food.restaurant.longitude,
            openTime: food.restaurant.openTime,
            closeTime: food.restaurant.closeTime,
            createdAt: food.restaurant.createdAt,
            updatedAt: food.restaurant.updatedAt,
            address: food.restaurant.address
              ? {
                  id: food.restaurant.address.id,
                  street: food.restaurant.address.street,
                  ward: food.restaurant.address.ward,
                  district: food.restaurant.address.district,
                  city: food.restaurant.address.city,
                  latitude: food.restaurant.address.latitude,
                  longitude: food.restaurant.address.longitude,
                }
              : null,
          }
        : null,
      // Only include top 3 reviews
      reviews: topReviews?.reviews
        ? topReviews.reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            image: review.image,
            createdAt: review.createdAt,
            user: review.user
              ? {
                  id: review.user.id,
                  name: review.user.name,
                  avatar: review.user.avatar,
                }
              : null,
          }))
        : [],
    };

    // Add distance if coordinates provided
    if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
      result.distance = haversineDistance(
        lat,
        lng,
        Number(food.restaurant.latitude),
        Number(food.restaurant.longitude),
      );
    }

    this.logger.debug(`Final result - Reviews count: ${result.reviews?.length || 0}`);
    this.logger.debug(`Final result - Total reviews: ${result.totalReviews}`);
    this.logger.debug(`Final result - Average rating: ${result.rating}`);
    this.logger.debug('=== End findOne Debug ===');

    return result;
  }

  /**
   * Get all toppings for a food
   */
  async getToppingsByFood(foodId: string): Promise<Topping[]> {
    const cacheKey = buildMenuCacheKey('food:toppings', { foodId });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.LONG, () =>
      this.toppingRepository.find({
        where: { food: { id: foodId } },
        order: { name: 'ASC' },
      }),
    );
  }
  async findExactFoodByName(name: string, restaurantId?: string): Promise<Food | null> {
    const query = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .where('LOWER(unaccent(food.name)) = LOWER(unaccent(:name))', { name });

    if (restaurantId) {
      query.andWhere('restaurant.id = :restaurantId', { restaurantId });
    }

    return query.getOne();
  }

  async findByName(
    name?: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    radius = 5,
    categoryIds?: string[],
    minPrice?: number,
    maxPrice?: number,
  ): Promise<{
    items: object[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('restaurant.address', 'address');

    if (name && name.trim()) {
      queryBuilder.where(
        '(unaccent(LOWER(food.name)) LIKE unaccent(LOWER(:name)) OR unaccent(LOWER(food.description)) LIKE unaccent(LOWER(:name)))',
        { name: `%${name.trim()}%` },
      );
    }

    if (categoryIds && categoryIds.length > 0) {
      if (name && name.trim()) {
        queryBuilder.andWhere('food.category_id IN (:...categoryIds)', { categoryIds });
      } else {
        queryBuilder.where('food.category_id IN (:...categoryIds)', { categoryIds });
      }
      this.logger.debug(`Added category filter: ${categoryIds.join(', ')}`);
    }

    if (minPrice !== undefined) {
      const whereMethod =
        (name && name.trim()) || (categoryIds && categoryIds.length > 0) ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.price >= :minPrice', { minPrice });
      this.logger.debug(`Added minPrice filter: ${minPrice}`);
    }

    if (maxPrice !== undefined) {
      const whereMethod =
        (name && name.trim()) || (categoryIds && categoryIds.length > 0) || minPrice !== undefined
          ? 'andWhere'
          : 'where';
      queryBuilder[whereMethod]('food.price <= :maxPrice', { maxPrice });
      this.logger.debug(`Added maxPrice filter: ${maxPrice}`);
    }

    const items = await queryBuilder.getMany();

    // --- Tính distance & deliveryTime bằng Mapbox (batch 5/lần) ---
    const itemsWithData: FoodQueryItem[] = [];

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);

      const processedBatch = await Promise.all(
        batch.map(async (food) => {
          const restaurant = food.restaurant;
          let distance: number | null = null;
          let duration: number | null = null;

          if (lat && lng && restaurant.latitude && restaurant.longitude) {
            const result = await this.routeService.getDistanceAndDuration(
              [Number(lng), Number(lat)],
              [Number(restaurant.longitude), Number(restaurant.latitude)],
            );

            if (result) {
              distance = Math.round(result.distanceKm * 10) / 10; // ✅ 1 chữ số thập phân
              duration = Math.round(result.durationMin);
            }
          }

          return {
            ...food,
            restaurant: {
              ...restaurant,
              distance,
              deliveryTime: duration,
            },
          };
        }),
      );

      itemsWithData.push(...processedBatch);
    }

    // Lọc theo radius nếu có lat/lng
    const filtered =
      lat && lng
        ? itemsWithData.filter((f) => {
            const distance = f.restaurant?.distance;
            return distance !== null && distance !== undefined && distance <= radius;
          })
        : itemsWithData;

    // Sort theo distance nếu có
    if (lat && lng) {
      filtered.sort(
        (a, b) => (a.restaurant?.distance ?? Infinity) - (b.restaurant?.distance ?? Infinity),
      );
    }

    const totalItems = filtered.length;
    const pagedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: pagedItems,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async getMenuForUser(_userId: string) {
    const foods = await this.foodRepository.find({
      relations: ['restaurant', 'restaurant.address'],
      order: { name: 'ASC' },
    });
    const restaurants = new Map<
      string,
      { id: string; name: string; address: unknown; foods: FoodQueryItem[] }
    >();

    for (const food of foods) {
      const restaurant = food.restaurant;
      if (!restaurant) continue;
      const menu = restaurants.get(restaurant.id) ?? {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        foods: [],
      };
      menu.foods.push({
        id: food.id,
        name: food.name,
        price: food.price,
        description: food.description,
        image: food.image,
        restaurantId: restaurant.id,
      });
      restaurants.set(restaurant.id, menu);
    }

    return [...restaurants.values()];
  }

  /**
   * Helper function to apply sorting to food items
   */
  private applySorting<T extends object>(
    items: T[],
    sortBy?: FoodSortType,
    lat?: number,
    lng?: number,
  ): T[] {
    const sortableItems = items as FoodQueryItem[];
    if (!sortBy) return items;

    switch (sortBy) {
      case 'newest':
        return sortableItems.sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        ) as T[];

      case 'nearby':
        if (lat && lng) {
          return sortableItems.sort((a, b) => {
            const distanceA = a.restaurant?.distance ?? Infinity;
            const distanceB = b.restaurant?.distance ?? Infinity;
            return distanceA - distanceB;
          }) as T[];
        }
        return items;

      case 'hot':
        // Sort by combination of rating and recent sales
        return sortableItems.sort((a, b) => {
          const scoreA = (a.rating || 0) * 0.7 + (a.soldCount || 0) * 0.3;
          const scoreB = (b.rating || 0) * 0.7 + (b.soldCount || 0) * 0.3;
          return scoreB - scoreA;
        }) as T[];

      case 'most_review':
        // Sort by number of reviews (using purchasedNumber as proxy)
        return sortableItems.sort(
          (a, b) => (b.purchasedNumber || 0) - (a.purchasedNumber || 0),
        ) as T[];

      case 'most_buy':
        return sortableItems.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)) as T[];

      case 'rating':
        return sortableItems.sort((a, b) => (b.rating || 0) - (a.rating || 0)) as T[];

      case 'price':
        return sortableItems.sort((a, b) => (a.price || 0) - (b.price || 0)) as T[];

      case 'name':
        return sortableItems.sort((a, b) => (a.name || '').localeCompare(b.name || '')) as T[];

      default:
        return items;
    }
  }

  /**
   * Helper function to apply sorting to query builder
   */
  private applySortingToQueryBuilder(
    queryBuilder: SelectQueryBuilder<Food>,
    sortBy?: FoodSortType,
  ): void {
    if (!sortBy) {
      queryBuilder.orderBy('food.createdAt', 'DESC');
      return;
    }

    switch (sortBy) {
      case 'newest':
        queryBuilder.orderBy('food.createdAt', 'DESC');
        break;
      case 'hot':
        queryBuilder.orderBy('food.rating', 'DESC').addOrderBy('food.soldCount', 'DESC');
        break;
      case 'most_review':
        queryBuilder.orderBy('food.purchasedNumber', 'DESC');
        break;
      case 'most_buy':
        queryBuilder.orderBy('food.soldCount', 'DESC');
        break;
      case 'rating':
        queryBuilder.orderBy('food.rating', 'DESC');
        break;
      case 'price':
        queryBuilder.orderBy('food.price', 'ASC');
        break;
      case 'name':
        queryBuilder.orderBy('food.name', 'ASC');
        break;
      default:
        queryBuilder.orderBy('food.createdAt', 'DESC');
        break;
    }
  }
}
