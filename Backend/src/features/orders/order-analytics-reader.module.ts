import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderReviewReaderModule } from 'src/features/reviews/review-reader.public-api';
import { OrderCoreService } from './services/order-core.service';
import { OrderAnalyticsReaderAdapter } from './services/order-cross-feature.adapters';

/** Narrow Orders export for Analytics; it deliberately does not load OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order]), OrderReviewReaderModule],
  providers: [OrderCoreService, OrderAnalyticsReaderAdapter],
  exports: [OrderAnalyticsReaderAdapter],
})
export class OrderAnalyticsReaderModule {}
