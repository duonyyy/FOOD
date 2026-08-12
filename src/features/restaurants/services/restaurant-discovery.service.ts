import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { estimateDeliveryTime, haversineDistance } from 'src/common/utils/geo.util';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import {
  FOOD_DISCOVERY_READER,
  type FoodDiscoveryReaderPort,
  type FoodPreviewSnapshot,
} from 'src/features/menu/public-api';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';

export type DiscoveredRestaurant = Restaurant & {
  distance: number | null;
  deliveryTime: number | null;
};

const RESTAURANT_CACHE_TTL_SECONDS = 60;

@Injectable()
export class RestaurantDiscoveryService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @Inject(FOOD_DISCOVERY_READER)
    private readonly foodDiscoveryReader: FoodDiscoveryReaderPort,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) {}

  async findAllApproved(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<ReturnType<RestaurantDiscoveryService['toPage']>> {
    const cacheKey = this.cacheKey('restaurant:approved', { page, pageSize, lat, lng });
    return this.cache.remember(cacheKey, RESTAURANT_CACHE_TTL_SECONDS, async () => {
      const [items, totalItems] = await this.restaurantRepository.findAndCount({
        where: { status: RestaurantStatus.APPROVED },
        relations: ['owner'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return this.toPage(
        items.map((item) => this.withDistance(item, lat, lng)),
        totalItems,
        page,
        pageSize,
      );
    });
  }

  async findAll(page = 1, pageSize = 10, lat?: number, lng?: number) {
    return this.findAllApproved(page, pageSize, lat, lng);
  }

  async getPreview(page = 1, pageSize = 10, lat?: number, lng?: number) {
    return this.findAllApproved(page, pageSize, lat, lng);
  }

  async findOne(id: string, lat?: number, lng?: number): Promise<DiscoveredRestaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id, status: RestaurantStatus.APPROVED },
      relations: ['owner'],
    });
    if (!restaurant) {
      throw new NotFoundException('Approved restaurant not found');
    }
    return this.withDistance(restaurant, lat, lng);
  }

  async getTopRestaurants(page = 1, pageSize = 10, lat?: number, lng?: number) {
    return this.findAllApproved(page, pageSize, lat, lng);
  }

  async getFoodsByRestaurantId(
    restaurantId: string,
    page = 1,
    pageSize = 3,
  ): Promise<FoodPreviewSnapshot[]> {
    await this.findOne(restaurantId);
    const cacheKey = this.cacheKey('restaurant:foods', { restaurantId, page, pageSize });
    return this.cache.remember(cacheKey, RESTAURANT_CACHE_TTL_SECONDS, () =>
      this.foodDiscoveryReader.listRestaurantFoods(restaurantId, page, pageSize),
    );
  }

  async getNameById(id: string): Promise<string> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id, status: RestaurantStatus.APPROVED },
      select: ['id', 'name'],
    });
    if (!restaurant?.name) {
      throw new NotFoundException('Approved restaurant not found');
    }
    return restaurant.name;
  }

  private withDistance(restaurant: Restaurant, lat?: number, lng?: number): DiscoveredRestaurant {
    const restaurantLat = restaurant.latitude ?? restaurant.address?.latitude;
    const restaurantLng = restaurant.longitude ?? restaurant.address?.longitude;
    const distance =
      lat !== undefined && lng !== undefined && restaurantLat != null && restaurantLng != null
        ? haversineDistance(lat, lng, Number(restaurantLat), Number(restaurantLng))
        : null;
    return {
      ...restaurant,
      distance,
      deliveryTime: distance === null ? null : estimateDeliveryTime(distance),
    };
  }

  private toPage(
    items: DiscoveredRestaurant[],
    totalItems: number,
    page: number,
    pageSize: number,
  ) {
    return { items, totalItems, page, pageSize, totalPages: Math.ceil(totalItems / pageSize) };
  }

  private cacheKey(namespace: string, values: Record<string, unknown>): string {
    const parts = Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `${namespace}:${JSON.stringify(parts)}`;
  }
}
