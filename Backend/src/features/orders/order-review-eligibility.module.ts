import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderReviewEligibilityService } from './services/order-cross-feature.adapters';

/** Narrow Orders dependency for Reviews; it does not load OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderReviewEligibilityService],
  exports: [OrderReviewEligibilityService],
})
export class OrderReviewEligibilityModule {}
