import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { OrdersModule } from 'src/features/orders/public-api';
import { MenuModule } from '../menu/public-api';
import { CustomerReviewsController } from './controllers/customer-reviews.controller';
import { FoodReviewsController } from './controllers/food-reviews.controller';
import { CustomerReviewsService } from './services/customer-reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review]), AuthModule, MenuModule, OrdersModule],
  controllers: [CustomerReviewsController, FoodReviewsController],
  providers: [CustomerReviewsService],
  exports: [CustomerReviewsService],
})
export class ReviewsModule {}
