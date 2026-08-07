import { Module } from '@nestjs/common';
import { OrderModule } from '../../modules/order/order.module';

/** Compatibility shell for the order aggregate. */
@Module({ imports: [OrderModule] })
export class OrdersModule {}
