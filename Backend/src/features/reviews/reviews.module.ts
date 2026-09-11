import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { MenuModule } from '../menu/public-api';
import { OrdersModule } from '../orders/public-api';
import { IdentityModule } from '../users/public-api';
import { CustomerReviewsController } from './controllers/customer-reviews.controller';
import { FoodReviewsController } from './controllers/food-reviews.controller';
import { OrderReviewReaderModule } from './order-review-reader.module';
import { CustomerReviewsService } from './services/customer-reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    IdentityModule,
    MenuModule,
    OrdersModule,
    OrderReviewReaderModule,
  ],
  controllers: [CustomerReviewsController, FoodReviewsController],
  providers: [CustomerReviewsService],
  exports: [CustomerReviewsService, OrderReviewReaderModule],
})
export class ReviewsModule {}
