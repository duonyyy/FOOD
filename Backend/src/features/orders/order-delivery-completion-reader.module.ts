import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryCompletionReaderService } from './services/order-delivery-completion-reader.service';

/** Narrow Orders export used by Delivery completion without importing OrdersModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderDeliveryCompletionReaderService],
  exports: [OrderDeliveryCompletionReaderService],
})
export class OrderDeliveryCompletionReaderModule {}
