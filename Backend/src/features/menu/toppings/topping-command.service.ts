import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';
import { CreateToppingDto } from '../../../modules/food/dto/create-topping.dto';
import { UpdateToppingDto } from '../../../modules/food/dto/update-topping.dto';
import {
  MERCHANT_CATALOG,
  type MerchantCatalogPort,
} from '../../restaurants/merchant-catalog.public-api';

/** Catalog write boundary for toppings. Every mutation verifies the owning restaurant. */
@Injectable()
export class ToppingCommandService {
  constructor(
    @InjectRepository(Food) private readonly foodRepository: Repository<Food>,
    @InjectRepository(Topping) private readonly toppingRepository: Repository<Topping>,
    @Inject(MERCHANT_CATALOG) private readonly merchantCatalog: MerchantCatalogPort,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  async create(foodId: string, dto: CreateToppingDto, actorId: string): Promise<Topping> {
    const food = await this.findFood(foodId);
    await this.merchantCatalog.assertCanManageRestaurant(food.restaurant.id, actorId);
    const name = normalizeToppingName(dto.name);
    validatePrice(dto.price);
    await this.assertUniqueName(foodId, name);

    try {
      const topping = this.toppingRepository.create({
        name,
        price: Number(dto.price),
        isAvailable: dto.isAvailable ?? true,
        food,
      });
      const saved = await this.toppingRepository.save(topping);
      await this.invalidate(foodId, food.restaurant.id);
      return saved;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A topping with this name already exists for this food');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateToppingDto, actorId: string): Promise<Topping> {
    const topping = await this.findTopping(id);
    await this.merchantCatalog.assertCanManageRestaurant(topping.food.restaurant.id, actorId);

    if (dto.name !== undefined) {
      const name = normalizeToppingName(dto.name);
      await this.assertUniqueName(topping.food.id, name, id);
      topping.name = name;
    }
    if (dto.price !== undefined) {
      validatePrice(dto.price);
      topping.price = Number(dto.price);
    }
    if (dto.isAvailable !== undefined) topping.isAvailable = dto.isAvailable;

    try {
      const saved = await this.toppingRepository.save(topping);
      await this.invalidate(topping.food.id, topping.food.restaurant.id);
      return saved;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A topping with this name already exists for this food');
      }
      throw error;
    }
  }

  async remove(id: string, actorId: string): Promise<void> {
    const topping = await this.findTopping(id);
    await this.merchantCatalog.assertCanManageRestaurant(topping.food.restaurant.id, actorId);
    await this.toppingRepository.remove(topping);
    await this.invalidate(topping.food.id, topping.food.restaurant.id);
  }

  private async findFood(foodId: string): Promise<Food> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      relations: ['restaurant'],
    });
    if (!food?.restaurant) throw new NotFoundException(`Food with ID ${foodId} not found`);
    return food;
  }

  private async findTopping(id: string): Promise<Topping> {
    const topping = await this.toppingRepository.findOne({
      where: { id },
      relations: ['food', 'food.restaurant'],
    });
    if (!topping?.food?.restaurant) throw new NotFoundException(`Topping with ID ${id} not found`);
    return topping;
  }

  private async assertUniqueName(foodId: string, name: string, exceptId?: string): Promise<void> {
    const existing = await this.toppingRepository
      .createQueryBuilder('topping')
      .where('topping.food_id = :foodId', { foodId })
      .andWhere('LOWER(TRIM(topping.name)) = LOWER(TRIM(:name))', { name })
      .andWhere(exceptId ? 'topping.id <> :exceptId' : '1 = 1', { exceptId })
      .getOne();
    if (existing)
      throw new ConflictException('A topping with this name already exists for this food');
  }

  private async invalidate(foodId: string, restaurantId: string): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern(`food:${foodId}:*`),
      this.cache.deleteByPattern(`food:restaurant:${restaurantId}:*`),
      this.cache.deleteByPattern('food:*'),
    ]);
  }
}

function normalizeToppingName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new ConflictException('Topping name cannot be empty');
  return normalized;
}

function validatePrice(price: string): void {
  const value = Number(price);
  if (!Number.isFinite(value) || value < 0 || !/^\d+(\.\d{1,2})?$/.test(price)) {
    throw new ConflictException(
      'Topping price must be a non-negative number with up to 2 decimals',
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
