import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Food } from 'src/entities/food.entity';
import { STORAGE_PORT, type StoragePort } from 'src/features/system-constraints/public-api';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';
import { FoodPaginationResult, FoodSortType } from './customer-food.service';

/**
 * Service phục vụ cho Quản trị viên (Admin):
 * - Tìm kiếm/Tra cứu món ăn toàn sàn (searchFoodsForStore)
 * - Cưỡng chế xóa món vi phạm chính sách (deleteByAdmin)
 */
@Injectable()
export class AdminFoodService {
  private readonly logger = new Logger(AdminFoodService.name);

  constructor(
    @InjectRepository(Food) private readonly foodRepository: Repository<Food>,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  /**
   * Cưỡng chế xóa món ăn vi phạm chính sách của sàn (dọn dẹp ảnh S3 và cache)
   */
  async deleteByAdmin(id: string): Promise<void> {
    const food = await this.foodRepository.findOne({
      where: { id },
      relations: ['restaurant', 'category'],
    });
    if (!food) throw new NotFoundException(`Food with ID ${id} not found`);

    await this.foodRepository.remove(food);

    await Promise.all(
      [food.image, ...(food.imageUrls || [])]
        .filter((url): url is string => Boolean(url))
        .map((url) => this.storage.deleteFile(url)),
    );

    await Promise.all([
      this.cache.deleteByPattern('food:*'),
      food.restaurant?.id
        ? this.cache.deleteByPattern(`restaurant:${food.restaurant.id}:*`)
        : Promise.resolve(0),
      food.category?.id
        ? this.cache.deleteByPattern(`category:${food.category.id}:*`)
        : Promise.resolve(0),
      this.cache.deleteByPattern(`food:${id}:*`),
    ]);
  }

  /**
   * Tra cứu danh sách món ăn toàn hệ thống với bộ lọc dành riêng cho Store / Admin
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
    this.logger.debug('=== searchFoodsForStore Debug ===', {
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

    // Sort items
    if (sortBy) {
      switch (sortBy) {
        case 'newest':
          items.sort(
            (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
          );
          break;
        case 'most_buy':
          items.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
          break;
        case 'rating':
          items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'price':
          items.sort((a, b) => (a.price || 0) - (b.price || 0));
          break;
        case 'name':
          items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
      }
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
}
