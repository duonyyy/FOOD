import { Module } from '@nestjs/common';
import { CatalogFoodModule } from '../../features/menu/foods/food.module';

/** Compatibility shell for legacy modules. Ownership lives in CatalogFoodModule. */
@Module({
  imports: [CatalogFoodModule],
  exports: [CatalogFoodModule],
})
export class FoodModule {}
