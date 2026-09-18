import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryLifecycleCommandService } from './services/order-delivery-lifecycle-command.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderDeliveryLifecycleCommandService],
  exports: [OrderDeliveryLifecycleCommandService],
})
export class OrderDeliveryLifecycleCommandModule {}
