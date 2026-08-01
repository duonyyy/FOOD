import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Checkout } from 'src/entities/checkout.entity';
import { Food } from 'src/entities/food.entity';
import { Notification } from 'src/entities/notification.entity';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { SystemConstraint } from 'src/entities/systemConstaints.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import { MapsModule } from 'src/infra/maps/maps.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { PaymentModule } from 'src/payment/payment.module';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { PromotionModule } from '../promotion/promotion.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { OrderController } from './order.controller';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';

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
      Notification,
      ShippingDetail,
      SystemConstraint,
      Topping,
    ]),
    JwtModule,
    PaymentModule,
    PromotionModule,
    RestaurantModule,
    QueueModule,
    MapsModule,
    StorageModule,
  ],

  controllers: [OrderController],
  providers: [OrderService, OrderResolver, SystemConstraintsService],
  exports: [OrderService],
})
export class OrderModule {}
