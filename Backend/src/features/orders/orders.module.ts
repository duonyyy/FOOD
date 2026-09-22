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
import { OrderAnalyticsService } from './services/order-analytics.service';
import { OrderCoreService } from './services/order-core.service';
import { OrderDeliveryAssignmentCommandService } from './services/order-delivery-assignment-command.service';
import {
  DeliveryAssignmentRequestedOrderHandler,
  DeliveryCompletedOrderHandler,
  PaymentSucceededOrderHandler,
  ShipperOfferRequestedOrderHandler,
} from './services/order-events.handler';
import { OrderReviewRulesService } from './services/order-review-rules.service';
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
    OrderReviewRulesService,
    OrderResolver,
    PaymentSucceededOrderHandler,
    DeliveryCompletedOrderHandler,
    DeliveryAssignmentRequestedOrderHandler,
    OrderDeliveryAssignmentCommandService,
    ShipperOfferRequestedOrderHandler,
    OrderAnalyticsService,
  ],
  exports: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    OrderReviewRulesService,
    OrderAnalyticsService,
  ],
})
export class OrdersModule {}
