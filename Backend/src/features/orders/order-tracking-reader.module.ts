import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { ORDER_TRACKING_READER } from './contracts/order-tracking-reader.port';
import { OrderTrackingReaderService } from './services/order-tracking-reader.service';

/** Narrow Orders export consumed by Delivery without importing OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [
    OrderTrackingReaderService,
    { provide: ORDER_TRACKING_READER, useExisting: OrderTrackingReaderService },
  ],
  exports: [ORDER_TRACKING_READER],
})
export class OrderTrackingReaderModule {}
