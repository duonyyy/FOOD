import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { OrdersModule } from 'src/features/orders/public-api';
import { MenuModule } from '../menu/public-api';
import { IdentityModule } from '../users/public-api';
import { CustomerReviewsController } from './controllers/customer-reviews.controller';
import { FoodReviewsController } from './controllers/food-reviews.controller';
import { CustomerReviewsService } from './services/customer-reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review]), IdentityModule, MenuModule, OrdersModule],
  controllers: [CustomerReviewsController, FoodReviewsController],
  providers: [CustomerReviewsService],
  exports: [CustomerReviewsService],
})
export class ReviewsModule {}
