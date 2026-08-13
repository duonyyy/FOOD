import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import {
  MERCHANT_CATALOG,
  type MerchantCatalogPort,
} from 'src/features/restaurants/merchant-catalog.public-api';
import { STORAGE_PORT, type StoragePort } from 'src/features/system-constraints/public-api';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';
import { CreateFoodDto } from '../../../modules/food/dto/create-food.dto';
import { UpdateFoodDto } from '../../../modules/food/dto/update-food.dto';
import { ToppingCommandService } from '../toppings/topping-command.service';

/** Commands are the only menu write boundary. Cache and object cleanup live here. */
@Injectable()
export class FoodCommandService {
  constructor(
    @InjectRepository(Food) private readonly foodRepository: Repository<Food>,
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @Inject(MERCHANT_CATALOG)
    private readonly merchantCatalog: MerchantCatalogPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly toppingCommand: ToppingCommandService,
  ) {}

  async create(dto: CreateFoodDto, actorId: string): Promise<Food> {
    await this.merchantCatalog.assertCanManageRestaurant(dto.restaurantId, actorId);
    const restaurant = { id: dto.restaurantId } as Food['restaurant'];

    const category = dto.categoryId
      ? await this.categoryRepository.findOne({ where: { id: dto.categoryId } })
      : undefined;
    if (dto.categoryId && !category) throw new BadRequestException('Category not found');

    const food = new Food();
    Object.assign(food, {
      name: dto.name,
      description: dto.description || '',
      price: dto.price ? parseFloat(dto.price) : 0,
      image: dto.image || '',
      discountPercent: dto.discountPercent ? parseFloat(dto.discountPercent) : 0,
      status: dto.status || 'available',
      purchasedNumber: dto.purchasedNumber ? parseInt(dto.purchasedNumber, 10) : 0,
      soldCount: 0,
      rating: 0,
      imageUrls: [],
      tag: '',
      preparationTime: dto.preparationTime ? parseInt(dto.preparationTime, 10) : 0,
      restaurant,
      category: category || undefined,
    });
    const savedFood = await this.foodRepository.save(food);

    if (dto.toppings?.length) {
      for (const item of dto.toppings) {
        await this.toppingCommand.create(savedFood.id, item, actorId);
      }
    }

    await this.invalidateMenuCache(savedFood.id, restaurant.id, category?.id);
    return (await this.foodRepository.findOne({
      where: { id: savedFood.id },
      relations: ['restaurant', 'category', 'toppings'],
    })) as Food;
  }

  async update(id: string, dto: UpdateFoodDto, actorId: string): Promise<Food> {
    const food = await this.foodRepository.findOne({
      where: { id },
      relations: ['restaurant', 'category'],
    });
    if (!food) throw new NotFoundException('Food not found');
    await this.merchantCatalog.assertCanManageRestaurant(food.restaurant.id, actorId);
    const oldImage = food.image;
    const oldImageUrls = [...(food.imageUrls || [])];
    const oldRestaurantId = food.restaurant.id;
    const oldCategoryId = food.category?.id;

    if (dto.restaurantId && dto.restaurantId !== oldRestaurantId) {
      await this.merchantCatalog.assertCanManageRestaurant(dto.restaurantId, actorId);
      food.restaurant = { id: dto.restaurantId } as Food['restaurant'];
    }
    if (dto.categoryId !== undefined) {
      food.category = dto.categoryId
        ? (await this.categoryRepository.findOne({ where: { id: dto.categoryId } })) || undefined
        : undefined;
      if (dto.categoryId && !food.category) throw new BadRequestException('Category not found');
    }

    const fields = { ...dto };
    delete fields.restaurantId;
    delete fields.categoryId;
    Object.assign(food, fields);
    const saved = await this.foodRepository.save(food);
    if (dto.image && dto.image !== oldImage && oldImage) await this.storage.deleteFile(oldImage);
    if (dto.imageUrls) {
      await Promise.all(
        oldImageUrls
          .filter((url) => !dto.imageUrls?.includes(url))
          .map((url) => this.storage.deleteFile(url)),
      );
    }
    await this.invalidateMenuCache(
      saved.id,
      saved.restaurant.id || oldRestaurantId,
      saved.category?.id || oldCategoryId,
    );
    return saved;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const food = await this.foodRepository.findOne({
      where: { id },
      relations: ['restaurant', 'category'],
    });
    if (!food) throw new NotFoundException(`Food with ID ${id} not found`);
    await this.merchantCatalog.assertCanManageRestaurant(food.restaurant.id, actorId);
    await this.foodRepository.remove(food);
    await this.invalidateMenuCache(id, food.restaurant.id, food.category?.id);
  }

  /** Admin-only compatibility command; permission is enforced by the controller guard. */
  async delete(id: string): Promise<void> {
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
    await this.invalidateMenuCache(id, food.restaurant?.id, food.category?.id);
  }

  async updateStatus(id: string, status: string, actorId: string): Promise<Food> {
    const food = await this.foodRepository.findOne({
      where: { id },
      relations: ['restaurant', 'category'],
    });
    if (!food) throw new NotFoundException('Food not found');
    await this.merchantCatalog.assertCanManageRestaurant(food.restaurant.id, actorId);
    food.status = status;
    const saved = await this.foodRepository.save(food);
    await this.invalidateMenuCache(id, food.restaurant.id, food.category?.id);
    return saved;
  }

  private async invalidateMenuCache(
    foodId?: string,
    restaurantId?: string,
    categoryId?: string,
  ): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern('food:*'),
      restaurantId
        ? this.cache.deleteByPattern(`restaurant:${restaurantId}:*`)
        : Promise.resolve(0),
      categoryId ? this.cache.deleteByPattern(`category:${categoryId}:*`) : Promise.resolve(0),
      foodId ? this.cache.deleteByPattern(`food:${foodId}:*`) : Promise.resolve(0),
    ]);
  }
}
