import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { IdentityModule } from '../identity/public-api';
import { MenuModule } from '../menu/public-api';
import { OrdersModule } from '../orders/public-api';
import { FoodReviewsController } from './food-reviews.controller';
import { ReviewService } from './review.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review]), IdentityModule, MenuModule, OrdersModule],
  controllers: [ReviewsController, FoodReviewsController],
  providers: [ReviewService],
})
export class ReviewsModule {}
