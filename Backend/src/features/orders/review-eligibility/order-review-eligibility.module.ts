import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { ORDER_REVIEW_ELIGIBILITY_READER } from '../contracts/order-review-eligibility-reader.port';
import { OrderReviewEligibilityService } from './order-review-eligibility.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [
    OrderReviewEligibilityService,
    { provide: ORDER_REVIEW_ELIGIBILITY_READER, useExisting: OrderReviewEligibilityService },
  ],
  exports: [ORDER_REVIEW_ELIGIBILITY_READER],
})
export class OrderReviewEligibilityModule {}
