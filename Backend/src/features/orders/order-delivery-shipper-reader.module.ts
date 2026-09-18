import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryShipperReaderService } from './services/order-delivery-shipper-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderDeliveryShipperReaderService],
  exports: [OrderDeliveryShipperReaderService],
})
export class OrderDeliveryShipperReaderModule {}
