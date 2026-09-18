import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { DeliveryModule } from 'src/features/delivery/public-api';
import { LocationsModule } from 'src/features/locations/public-api';
import { MenuModule } from 'src/features/menu/public-api';
import { PaymentModule } from 'src/features/payments/public-api';
import { PromotionsModule } from 'src/features/promotions/public-api';
import { RestaurantsModule } from 'src/features/restaurants/public-api';
import { OrderReviewReaderModule } from 'src/features/reviews/review-reader.public-api';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { OrderController } from './controllers/order.controller';
import { OrderResolver } from './controllers/order.resolver';
import { AdminOrdersService } from './services/admin-orders.service';
import { CustomerOrdersService } from './services/customer-orders.service';
import { MerchantOrdersService } from './services/merchant-orders.service';
import { OrderCoreService } from './services/order-core.service';
import {
  ChatOrderingService,
  OrderAnalyticsReaderAdapter,
  OrderNotificationReaderAdapter,
} from './services/order-cross-feature.adapters';
import {
  DeliveryCompletedOrderHandler,
  PaymentSucceededOrderHandler,
} from './services/order-events.handler';
import { OrderMessagingReaderService } from './services/order-messaging-reader.service';
import { OrderService } from './services/order.service';

/** Owns order HTTP/GraphQL APIs, role services, commands, queries and order persistence wiring. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderDetail]),
    AuthModule,
    EventsModule,
    JwtModule,
    PaymentModule,
    PromotionsModule,
    IdentityModule,
    RestaurantsModule,
    OrderReviewReaderModule,
    DeliveryModule,
    LocationsModule,
    MenuModule,
    SystemConstraintsModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    OrderMessagingReaderService,
    OrderResolver,
    PaymentSucceededOrderHandler,
    DeliveryCompletedOrderHandler,
    ChatOrderingService,
    OrderAnalyticsReaderAdapter,
    OrderNotificationReaderAdapter,
  ],
  exports: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    ChatOrderingService,
    OrderAnalyticsReaderAdapter,
    OrderMessagingReaderService,
    OrderNotificationReaderAdapter,
  ],
})
export class OrdersModule {}
