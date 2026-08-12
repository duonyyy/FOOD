import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Repository } from 'typeorm';
import {
  type FoodReviewTargetReaderPort,
  type FoodReviewTargetSnapshot,
} from '../contracts/food-review-target-reader.port';

@Injectable()
export class FoodReviewTargetService implements FoodReviewTargetReaderPort {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
  ) {}

  async findFoodReviewTarget(foodId: string): Promise<FoodReviewTargetSnapshot | null> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      select: ['id', 'name'],
    });

    return food ? { foodId: food.id, name: food.name ?? null } : null;
  }
}
