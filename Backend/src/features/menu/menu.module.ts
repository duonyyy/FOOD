import { Module } from '@nestjs/common';
import { CategoryModule } from './categories/category.module';
import { FoodDiscoveryReaderModule } from './food-discovery/food-discovery-reader.module';
import { FoodReviewTargetModule } from './food-review-target/food-review-target.module';
import { CatalogFoodModule } from './foods/food.module';
import { MenuReaderModule } from './orderable/menu-reader.module';
import { ToppingModule } from './toppings/topping.module';

/** Catalog composition: Food/MenuItem, Category and Topping ownership. */
@Module({
  imports: [
    CategoryModule,
    CatalogFoodModule,
    ToppingModule,
    MenuReaderModule,
    FoodReviewTargetModule,
    FoodDiscoveryReaderModule,
  ],
  exports: [
    CategoryModule,
    CatalogFoodModule,
    ToppingModule,
    MenuReaderModule,
    FoodReviewTargetModule,
    FoodDiscoveryReaderModule,
  ],
})
export class MenuModule {}
