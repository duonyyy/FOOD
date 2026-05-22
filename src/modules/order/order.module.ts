import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from 'src/entities/order.entity';
import { User } from 'src/entities/user.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Role } from 'src/entities/role.entity';
import { Food } from 'src/entities/food.entity';
import { UsersService } from '../users/users.service';
import { Address } from 'src/entities/address.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { JwtModule } from '@nestjs/jwt';
import { Checkout } from 'src/entities/checkout.entity';
import { PaymentModule } from 'src/payment/payment.module';
import { OrderResolver } from './order.resolver';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { PromotionService } from '../promotion/promotion.service';
import { GoogleCloudStorageService } from 'src/gcs/gcs.service';
import { QueueModule } from 'src/queue/queue.module';
import { Review } from 'src/entities/review.entity';
import { Notification } from 'src/entities/notification.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { SystemConstraint } from 'src/entities/systemConstaints.entity';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { Topping } from 'src/entities/topping.entity';
import { MapboxService } from 'src/services/mapbox.service';
import { DeliveryRouteService } from './delivery-route.service';
import { OrderDetailFactory } from './order-detail.factory';
import { OrderEventService } from './order-event.service';
import { OrderPricingService } from './order-pricing.service';
import { OrderPromotionService } from './order-promotion.service';
import { OrderSanitizer } from './order-sanitizer';
import { OrderSchedulerService } from './order-scheduler.service';
import { OrderValidationService } from './order-validation.service';

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
      Promotion,
      Review,
      Notification,
      ShippingDetail,
      SystemConstraint,
      Topping,
    ]),
    JwtModule,
    PaymentModule,
    RestaurantModule,
    QueueModule,
  ],

  controllers: [OrderController],
  providers: [
    OrderService,
    OrderValidationService,
    DeliveryRouteService,
    OrderPricingService,
    OrderPromotionService,
    OrderDetailFactory,
    OrderEventService,
    OrderSchedulerService,
    OrderSanitizer,
    UsersService,
    OrderResolver,
    PromotionService,
    GoogleCloudStorageService,
    SystemConstraintsService,
    MapboxService,
  ],
  exports: [OrderService],
})
export class OrderModule {}
