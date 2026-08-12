import { Module } from '@nestjs/common';
import { FoodModule } from '../../modules/food/food.module';
import { CategoryModule } from './categories/category.module';
import { FoodDiscoveryReaderModule } from './food-discovery/food-discovery-reader.module';
import { FoodReviewTargetModule } from './food-review-target/food-review-target.module';

/** Catalog composition: migrated Category slice plus legacy Food/Topping compatibility. */
@Module({
  imports: [CategoryModule, FoodModule, FoodReviewTargetModule, FoodDiscoveryReaderModule],
  exports: [CategoryModule, FoodReviewTargetModule, FoodDiscoveryReaderModule],
})
export class MenuModule {}
