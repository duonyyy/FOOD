import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { MerchantCatalogModule } from 'src/features/restaurants/merchant-catalog.public-api';
import { CategoryModule } from './categories/category.module';
import { AdminFoodController } from './foods/controllers/admin-food.controller';
import { CustomerFoodController } from './foods/controllers/customer-food.controller';
import { MerchantFoodController } from './foods/controllers/merchant-food.controller';
import { AdminFoodService } from './foods/services/admin-food.service';
import { CustomerFoodService } from './foods/services/customer-food.service';
import { FoodCommandService } from './foods/services/food-command.service';
import { FoodIntegrationService } from './foods/services/food-integration.service';
import { FoodQueryService } from './foods/services/food-query.service';
import { MerchantFoodService } from './foods/services/merchant-food.service';
import { ToppingModule } from './toppings/topping.module';

/** Catalog feature: Food/MenuItem, Category and Topping ownership. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Food, Category, Topping]),
    AuthModule,
    MerchantCatalogModule,
    CategoryModule,
    ToppingModule,
  ],
  controllers: [CustomerFoodController, MerchantFoodController, AdminFoodController],
  providers: [
    CustomerFoodService,
    MerchantFoodService,
    AdminFoodService,
    FoodIntegrationService,
    FoodQueryService,
    FoodCommandService,
  ],
  exports: [
    CategoryModule,
    CustomerFoodService,
    MerchantFoodService,
    AdminFoodService,
    FoodIntegrationService,
    FoodQueryService,
    FoodCommandService,
    ToppingModule,
  ],
})
export class MenuModule {}
