import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryDispatchReaderService } from './services/order-delivery-dispatch-reader.service';

/** Narrow Orders export used by Delivery dispatching without importing OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderDeliveryDispatchReaderService],
  exports: [OrderDeliveryDispatchReaderService],
})
export class OrderDeliveryDispatchReaderModule {}
