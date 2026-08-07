import { Module } from '@nestjs/common';
import { CategoryModule } from '../../modules/category/category.module';
import { FoodModule } from '../../modules/food/food.module';

/** Compatibility shell for food, category and topping ownership. */
@Module({ imports: [CategoryModule, FoodModule] })
export class MenuModule {}
