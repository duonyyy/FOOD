import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { LocationsModule } from 'src/features/locations/public-api';
import { MenuModule } from 'src/features/menu/public-api';
import { PaymentModule } from 'src/features/payments/public-api';
import { PromotionsModule } from 'src/features/promotions/public-api';
import { RestaurantsModule } from 'src/features/restaurants/public-api';
import { OrderReviewReaderModule } from 'src/features/reviews/review-reader.public-api';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { CustomerOrdersController } from './controllers/customer-orders.controller';
import { MerchantOrdersController } from './controllers/merchant-orders.controller';
import { OrderResolver } from './controllers/order.resolver';
import { PublicOrdersController } from './controllers/public-orders.controller';
import { AdminOrdersService } from './services/admin-orders.service';
import { CustomerOrdersService } from './services/customer-orders.service';
import { MerchantOrdersService } from './services/merchant-orders.service';
import { OrderCoreService } from './services/order-core.service';
import {
  ChatOrderingService,
  OrderAnalyticsReaderAdapter,
} from './services/order-cross-feature.adapters';
import { OrderDeliveryAssignmentCommandService } from './services/order-delivery-assignment-command.service';
import {
  DeliveryAssignmentRequestedOrderHandler,
  DeliveryCompletedOrderHandler,
  PaymentSucceededOrderHandler,
  ShipperOfferRequestedOrderHandler,
} from './services/order-events.handler';
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
    LocationsModule,
    MenuModule,
    SystemConstraintsModule,
  ],
  controllers: [
    PublicOrdersController,
    CustomerOrdersController,
    MerchantOrdersController,
    AdminOrdersController,
  ],
  providers: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    OrderResolver,
    PaymentSucceededOrderHandler,
    DeliveryCompletedOrderHandler,
    DeliveryAssignmentRequestedOrderHandler,
    OrderDeliveryAssignmentCommandService,
    ShipperOfferRequestedOrderHandler,
    ChatOrderingService,
    OrderAnalyticsReaderAdapter,
  ],
  exports: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    ChatOrderingService,
    OrderAnalyticsReaderAdapter,
  ],
})
export class OrdersModule {}
