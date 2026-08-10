import { Module } from '@nestjs/common';
import { FoodModule } from '../../modules/food/food.module';
import { CategoryModule } from './categories/category.module';

/** Catalog composition: migrated Category slice plus legacy Food/Topping compatibility. */
@Module({
  imports: [CategoryModule, FoodModule],
  exports: [CategoryModule],
})
export class MenuModule {}
