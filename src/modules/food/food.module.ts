import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Topping } from 'src/entities/topping.entity';
import { StorageModule } from 'src/infra/storage/storage.module';
import { UsersModule } from '../users/users.module';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, Restaurant, Category, Order, Review, Topping]),
    JwtModule,
    StorageModule,
    UsersModule,
  ],
  controllers: [FoodController],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
