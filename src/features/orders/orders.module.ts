import { Module } from '@nestjs/common';
import { OrderModule } from '../../modules/order/order.module';
import { OrderReviewEligibilityModule } from './review-eligibility/order-review-eligibility.module';

/** Compatibility shell for the order aggregate. */
@Module({
  imports: [OrderModule, OrderReviewEligibilityModule],
  exports: [OrderReviewEligibilityModule],
})
export class OrdersModule {}
