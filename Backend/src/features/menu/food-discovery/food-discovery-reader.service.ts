import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Repository } from 'typeorm';
import {
  type CatalogChatFoodSnapshot,
  type CatalogChatReaderPort,
} from '../contracts/catalog-chat-reader.port';
import {
  type FoodDiscoveryReaderPort,
  type FoodPreviewSnapshot,
} from '../contracts/food-discovery-reader.port';

@Injectable()
export class FoodDiscoveryReaderService implements FoodDiscoveryReaderPort, CatalogChatReaderPort {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
  ) {}

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
      where: {
        status: 'available',
      },
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
}
