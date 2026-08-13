import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Checkout } from 'src/entities/checkout.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { MapsModule } from 'src/infra/maps/maps.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { PaymentModule } from 'src/payment/payment.module';
import { RestaurantsModule } from '../../features/restaurants/restaurants.module';
import { PromotionModule } from '../promotion/promotion.module';
import { UsersModule } from '../users/users.module';
import { OrderCommandService } from './order-command.service';
import { OrderCreateService } from './order-create.service';
import { OrderQueryService } from './order-query.service';
import { OrderController } from './order.controller';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';
import { PaymentSucceededOrderHandler } from './payment-succeeded-order.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      User,
      Restaurant,
      OrderDetail,
      Role,
      Food,
      Address,
      Promotion,
      Checkout,
      Review,
      ShippingDetail,
      Topping,
    ]),
    JwtModule,
    PaymentModule,
    PromotionModule,
    UsersModule,
    RestaurantsModule,
    QueueModule,
    MapsModule,
    StorageModule,
    UsersModule,
    SystemConstraintsModule,
  ],

  controllers: [OrderController],
  providers: [
    OrderService,
    OrderCommandService,
    OrderCreateService,
    OrderQueryService,
    OrderResolver,
    PaymentSucceededOrderHandler,
  ],
  exports: [OrderService],
})
export class OrderModule {}
