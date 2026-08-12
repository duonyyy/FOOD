import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { FOOD_REVIEW_TARGET_READER } from '../contracts/food-review-target-reader.port';
import { FoodReviewTargetService } from './food-review-target.service';

@Module({
  imports: [TypeOrmModule.forFeature([Food])],
  providers: [
    FoodReviewTargetService,
    { provide: FOOD_REVIEW_TARGET_READER, useExisting: FoodReviewTargetService },
  ],
  exports: [FOOD_REVIEW_TARGET_READER],
})
export class FoodReviewTargetModule {}
