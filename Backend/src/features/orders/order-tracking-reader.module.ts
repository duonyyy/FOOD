import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderTrackingReaderService } from './services/order-tracking-reader.service';

/** Narrow Orders export consumed by Delivery without importing OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderTrackingReaderService],
  exports: [OrderTrackingReaderService],
})
export class OrderTrackingReaderModule {}
