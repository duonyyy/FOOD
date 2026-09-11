import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'src/common/pagination/paginate';
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
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { buildMenuCacheKey, MENU_CACHE_TTL_SECONDS } from '../../contracts/menu-cache.policy';

export type FoodSortType =
  | 'newest'
  | 'nearby'
  | 'hot'
  | 'most_review'
  | 'most_buy'
  | 'rating'
  | 'price'
  | 'name';

export type FoodVisibilityScope = 'admin' | 'public';

const PUBLIC_FOOD_STATUS = 'available';
const PUBLIC_RESTAURANT_STATUS = 'approved';
const PUBLIC_MENU_CACHE_VERSION = 'v2';

export type FoodQueryRestaurant = {
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

export interface FoodPaginationResult {
  items: object[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Service phục vụ cho Khách hàng (Customer):
 * - Xem thực đơn, tìm kiếm món ăn, tính cự ly Geolocation / Mapbox
 * - Lọc món hot, món mới, món giảm giá, phân loại theo quán & danh mục
 */
@Injectable()
export class CustomerFoodService {
  private readonly logger = new Logger(CustomerFoodService.name);

  constructor(
    @InjectRepository(Food)
    protected readonly foodRepository: Repository<Food>,
    @InjectRepository(Category)
    protected readonly categoryRepository: Repository<Category>,
    @InjectRepository(Topping)
    protected readonly toppingRepository: Repository<Topping>,
    @Inject(MERCHANT_CATALOG)
    protected readonly merchantCatalog: MerchantCatalogPort,
    @Inject(CACHE_PORT)
    protected readonly cacheService: CachePort,
    @Inject(ROUTE_PORT)
    protected readonly routeService: RoutePort,
  ) {}

  private enrichWithDistance(
    items: Food[],
    lat?: number,
    lng?: number,
    restaurantContext?: { latitude?: number | string | null; longitude?: number | string | null },
  ): object[] {
    return items.map((food) => {
      let distance: number | null = null;
      const rLat = restaurantContext?.latitude ?? food.restaurant?.latitude;
      const rLng = restaurantContext?.longitude ?? food.restaurant?.longitude;
      if (lat && lng && rLat && rLng) {
        distance = haversineDistance(lat, lng, Number(rLat), Number(rLng));
      }
      return { ...food, distance };
    });
  }

  private async paginateAndEnrich(
    queryBuilder: SelectQueryBuilder<Food>,
    page: number,
    pageSize: number,
    lat?: number,
    lng?: number,
    sortBy?: FoodSortType,
  ) {
    const paginated = await paginate(queryBuilder, page, pageSize);
    let itemsWithDistance = this.enrichWithDistance(paginated.items, lat, lng);
    if (sortBy === 'nearby' && lat && lng) {
      itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
    }
    return {
      items: itemsWithDistance,
      totalItems: paginated.totalItems,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalPages: paginated.totalPages,
    };
  }

  private async requireRestaurant(restaurantId: string) {
    const restaurant = await this.merchantCatalog.findRestaurant(restaurantId);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
    }
    return restaurant;
  }

  private applyPublicMenuVisibility(queryBuilder: SelectQueryBuilder<Food>): void {
    queryBuilder
      .andWhere('food.status = :publicFoodStatus', { publicFoodStatus: PUBLIC_FOOD_STATUS })
      .andWhere('restaurant.status = :publicRestaurantStatus', {
        publicRestaurantStatus: PUBLIC_RESTAURANT_STATUS,
      });
  }

  private applyFoodVisibility(
    queryBuilder: SelectQueryBuilder<Food>,
    scope: FoodVisibilityScope,
    status?: string,
  ): void {
    if (scope === 'public') {
      this.applyPublicMenuVisibility(queryBuilder);
      return;
    }

    if (status) {
      queryBuilder.andWhere('food.status = :status', { status });
    }
  }

  async getTopFoodsByRestaurant(restaurantId: string, limit = 5): Promise<object[]> {
    const cacheKey = buildMenuCacheKey('food:topByRestaurant', {
      restaurantId,
      limit,
      visibility: PUBLIC_MENU_CACHE_VERSION,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoin('food.restaurant', 'restaurant')
        .where('food.restaurant_id = :restaurantId', { restaurantId });
      this.applyPublicMenuVisibility(queryBuilder);
      const foods = await queryBuilder.orderBy('food.soldCount', 'DESC').take(limit).getMany();

      return foods.map((food) => ({
        id: food.id,
        name: food.name,
        image: food.image,
        soldCount: food.soldCount,
        revenue: food.soldCount * food.price,
      }));
    });
  }

  async findAll(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
    scope: FoodVisibilityScope = 'public',
  ): Promise<FoodPaginationResult> {
    const cacheKey = buildMenuCacheKey('food:findAll', {
      page,
      pageSize,
      lat,
      lng,
      status,
      sortBy,
      scope,
      visibility: PUBLIC_MENU_CACHE_VERSION,
    });
    return this.cacheService.remember(cacheKey, MENU_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const queryBuilder = this.foodRepository
        .createQueryBuilder('food')
        .leftJoinAndSelect('food.restaurant', 'restaurant')
        .leftJoinAndSelect('food.category', 'category');

      this.applyFoodVisibility(queryBuilder, scope, status);

      this.applySortingToQueryBuilder(queryBuilder, sortBy);
      return this.paginateAndEnrich(queryBuilder, page, pageSize, lat, lng, sortBy);
    });
  }

  async findByRestaurantAndCategory(
    restaurantId: string,
    categoryId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
    scope: FoodVisibilityScope = 'public',
  ): Promise<FoodPaginationResult> {
    const restaurant = await this.requireRestaurant(restaurantId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.category_id = :categoryId', { categoryId });

    this.applyFoodVisibility(queryBuilder, scope, status);

    this.applySortingToQueryBuilder(queryBuilder, sortBy);

    const result = await paginate(queryBuilder, page, pageSize);
    let itemsWithDistance = this.enrichWithDistance(result.items, lat, lng, restaurant);

    if (sortBy === 'nearby' && lat && lng) {
      itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
    }

    return {
      ...result,
      items: itemsWithDistance,
    };
  }

  async findByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    status?: string,
    sortBy?: FoodSortType,
    scope: FoodVisibilityScope = 'public',
  ): Promise<FoodPaginationResult> {
    const restaurant = await this.requireRestaurant(restaurantId);

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId });

    this.applyFoodVisibility(queryBuilder, scope, status);

    this.applySortingToQueryBuilder(queryBuilder, sortBy);

    const result = await paginate(queryBuilder, page, pageSize);
    let itemsWithDistance = this.enrichWithDistance(result.items, lat, lng, restaurant);

    if (sortBy === 'nearby' && lat && lng) {
      itemsWithDistance = this.applySorting(itemsWithDistance, sortBy, lat, lng);
    }

    return {
      ...result,
      items: itemsWithDistance,
    };
  }

  async findByCategory(
    categoryId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    scope: FoodVisibilityScope = 'public',
  ): Promise<FoodPaginationResult> {
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .where('food.category_id = :categoryId', { categoryId })
      .orderBy('food.createdAt', 'DESC');

    if (scope === 'public') {
      this.applyPublicMenuVisibility(queryBuilder);
    }

    return this.paginateAndEnrich(queryBuilder, page, pageSize, lat, lng);
  }

  async findTopSelling(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .orderBy('food.soldCount', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    return this.paginateAndEnrich(queryBuilder, page, pageSize, lat, lng);
  }

  async findNewest(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .orderBy('food.createdAt', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    return this.paginateAndEnrich(queryBuilder, page, pageSize, lat, lng);
  }

  async findTopSellingByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const restaurant = await this.requireRestaurant(restaurantId);

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('food.soldCount', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    const result = await paginate(queryBuilder, page, pageSize);
    return {
      ...result,
      items: this.enrichWithDistance(result.items, lat, lng, restaurant),
    };
  }

  async findByCategoryAndRestaurant(
    categoryId: string,
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const restaurant = await this.requireRestaurant(restaurantId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.category_id = :categoryId', { categoryId })
      .orderBy('food.createdAt', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    const result = await paginate(queryBuilder, page, pageSize);
    return {
      ...result,
      items: this.enrichWithDistance(result.items, lat, lng, restaurant),
    };
  }

  async findWithDiscount(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .where('food.discountPercent IS NOT NULL')
      .andWhere('food.discountPercent != :zero', { zero: '0' })
      .orderBy('CAST(food.discountPercent AS DECIMAL)', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    return this.paginateAndEnrich(queryBuilder, page, pageSize, lat, lng);
  }

  async findWithDiscountByRestaurant(
    restaurantId: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<FoodPaginationResult> {
    const restaurant = await this.requireRestaurant(restaurantId);

    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.discountPercent IS NOT NULL')
      .andWhere('food.discountPercent != :zero', { zero: '0' })
      .orderBy('CAST(food.discountPercent AS DECIMAL)', 'DESC');

    this.applyPublicMenuVisibility(queryBuilder);

    const result = await paginate(queryBuilder, page, pageSize);
    return {
      ...result,
      items: this.enrichWithDistance(result.items, lat, lng, restaurant),
    };
  }

  async searchFoods(
    query: string,
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
    radius = 5,
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

    this.applyPublicMenuVisibility(queryBuilder);

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
        .filter((f) => f.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    } else {
      items = items.map((f) => ({ ...f, distance: null }));
    }

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
  ): Promise<FoodPaginationResult> {
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
    }

    if (minPrice !== undefined) {
      const whereMethod =
        (name && name.trim()) || (categoryIds && categoryIds.length > 0) ? 'andWhere' : 'where';
      queryBuilder[whereMethod]('food.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      const whereMethod =
        (name && name.trim()) || (categoryIds && categoryIds.length > 0) || minPrice !== undefined
          ? 'andWhere'
          : 'where';
      queryBuilder[whereMethod]('food.price <= :maxPrice', { maxPrice });
    }

    this.applyPublicMenuVisibility(queryBuilder);

    const items = await queryBuilder.getMany();

    // Mapbox routing distance calculation (batch 5)
    const itemsWithData: FoodQueryItem[] = [];

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);

      const processedBatch = await Promise.all(
        batch.map(async (food) => {
          const restaurant = food.restaurant;
          let distance: number | null = null;
          let duration: number | null = null;

          if (lat && lng && restaurant?.latitude && restaurant?.longitude) {
            const result = await this.routeService.getDistanceAndDuration(
              [Number(lng), Number(lat)],
              [Number(restaurant.longitude), Number(restaurant.latitude)],
            );

            if (result) {
              distance = Math.round(result.distanceKm * 10) / 10;
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

    const filtered =
      lat && lng
        ? itemsWithData.filter((f) => {
            const distance = f.restaurant?.distance;
            return distance !== null && distance !== undefined && distance <= radius;
          })
        : itemsWithData;

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

  async findOne(id: string, lat?: number, lng?: number): Promise<FoodQueryItem> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('food.toppings', 'toppings')
      .leftJoinAndSelect('restaurant.address', 'address')
      .leftJoinAndSelect('restaurant.user', 'user')
      .where('food.id = :id', { id });
    this.applyPublicMenuVisibility(queryBuilder);
    const food = await queryBuilder.getOne();

    if (!food) {
      throw new NotFoundException(`Food with ID ${id} not found`);
    }

    const rawStats = await this.foodRepository.query(
      `
      SELECT
        COUNT(r.id) AS total_reviews,
        AVG(r.rating) AS average_rating
      FROM reviews r
      WHERE r.food_id = $1
    `,
      [id],
    );

    const totalReviews = rawStats[0]?.total_reviews ? parseInt(rawStats[0].total_reviews, 10) : 0;
    const averageRating = rawStats[0]?.average_rating
      ? parseFloat(rawStats[0].average_rating)
      : null;

    let distance: number | null = null;
    let deliveryTime: number | null = null;

    if (lat && lng && food.restaurant?.latitude && food.restaurant?.longitude) {
      const result = await this.routeService.getDistanceAndDuration(
        [Number(lng), Number(lat)],
        [Number(food.restaurant.longitude), Number(food.restaurant.latitude)],
      );

      if (result) {
        distance = Math.round(result.distanceKm * 10) / 10;
        deliveryTime = Math.round(result.durationMin);
      }
    }

    return {
      ...food,
      rating: averageRating ?? food.rating,
      totalReviews,
      distance,
      restaurant: food.restaurant
        ? {
            ...food.restaurant,
            distance,
            deliveryTime,
          }
        : null,
    };
  }

  async getToppingsByFood(foodId: string): Promise<Topping[]> {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.toppings', 'toppings')
      .leftJoin('food.restaurant', 'restaurant')
      .where('food.id = :foodId', { foodId });
    this.applyPublicMenuVisibility(queryBuilder);
    const food = await queryBuilder.getOne();

    if (!food) {
      throw new NotFoundException(`Food with ID ${foodId} not found`);
    }

    return food.toppings ?? [];
  }

  async findExactFoodByName(name: string, restaurantId?: string): Promise<Food | null> {
    const query = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .where('LOWER(TRIM(food.name)) = LOWER(TRIM(:name))', { name });

    if (restaurantId) {
      query.andWhere('restaurant.id = :restaurantId', { restaurantId });
    }

    this.applyPublicMenuVisibility(query);

    return query.getOne();
  }

  async getMenuForUser(_userId: string) {
    const queryBuilder = this.foodRepository
      .createQueryBuilder('food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .leftJoinAndSelect('restaurant.address', 'address')
      .orderBy('food.name', 'ASC');
    this.applyPublicMenuVisibility(queryBuilder);
    const foods = await queryBuilder.getMany();
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

  applySorting<T extends object>(
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
        return sortableItems.sort((a, b) => {
          const scoreA = (a.rating || 0) * 0.7 + (a.soldCount || 0) * 0.3;
          const scoreB = (b.rating || 0) * 0.7 + (b.soldCount || 0) * 0.3;
          return scoreB - scoreA;
        }) as T[];

      case 'most_review':
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

  static readonly SORT_STRATEGIES: Record<FoodSortType, (qb: SelectQueryBuilder<Food>) => void> = {
    newest: (qb) => qb.orderBy('food.createdAt', 'DESC'),
    hot: (qb) => qb.orderBy('food.rating', 'DESC').addOrderBy('food.soldCount', 'DESC'),
    most_review: (qb) => qb.orderBy('food.purchasedNumber', 'DESC'),
    most_buy: (qb) => qb.orderBy('food.soldCount', 'DESC'),
    rating: (qb) => qb.orderBy('food.rating', 'DESC'),
    price: (qb) => qb.orderBy('food.price', 'ASC'),
    name: (qb) => qb.orderBy('food.name', 'ASC'),
    nearby: () => {},
  };

  applySortingToQueryBuilder(queryBuilder: SelectQueryBuilder<Food>, sortBy?: FoodSortType): void {
    const strategy = sortBy ? CustomerFoodService.SORT_STRATEGIES[sortBy] : undefined;
    if (strategy) {
      strategy(queryBuilder);
    } else {
      queryBuilder.orderBy('food.createdAt', 'DESC');
    }
  }
}
