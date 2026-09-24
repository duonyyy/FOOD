import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { MerchantCatalogModule } from 'src/features/restaurants/merchant-catalog.public-api';
import { CategoryController } from './categories/category.controller';
import { CategoryService } from './categories/category.service';
import { AdminFoodController } from './foods/controllers/admin-food.controller';
import { CustomerFoodController } from './foods/controllers/customer-food.controller';
import { MerchantFoodController } from './foods/controllers/merchant-food.controller';
import { FoodAdminService } from './foods/services/food-admin.service';
import { FoodCustomerService } from './foods/services/food-customer.service';
import { FoodIntegrationService } from './foods/services/food-integration.service';
import { FoodMerchantService } from './foods/services/food-merchant.service';
import { FoodToppingService } from './foods/services/food-topping.service';

/** Catalog feature: Food/MenuItem, Category and Topping ownership. */
@Module({
  imports: [TypeOrmModule.forFeature([Food, Category, Topping]), AuthModule, MerchantCatalogModule],
  controllers: [
    CategoryController,
    CustomerFoodController,
    MerchantFoodController,
    AdminFoodController,
  ],
  providers: [
    CategoryService,
    FoodCustomerService,
    FoodMerchantService,
    FoodAdminService,
    FoodIntegrationService,
    FoodToppingService,
  ],
  exports: [
    CategoryService,
    FoodCustomerService,
    FoodMerchantService,
    FoodAdminService,
    FoodIntegrationService,
    FoodToppingService,
  ],
})
export class MenuModule {}
