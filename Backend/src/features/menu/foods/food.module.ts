import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { FoodController } from '../../../modules/food/food.controller';
import { MerchantCatalogModule } from '../../restaurants/merchant-catalog.public-api';
import { FoodCommandService } from '../services/food-command.service';
import { ToppingModule } from '../toppings/topping.module';
import { FoodQueryService } from './food-query.service';

/** Catalog owns Food/MenuItem persistence and exposes the legacy HTTP controller during migration. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Food, Category, Topping]),
    AuthModule,
    MerchantCatalogModule,
    ToppingModule,
  ],
  controllers: [FoodController],
  providers: [FoodQueryService, FoodCommandService],
  exports: [FoodQueryService, FoodCommandService, ToppingModule],
})
export class CatalogFoodModule {}
