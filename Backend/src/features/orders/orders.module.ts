import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { DeliveryModule } from 'src/features/delivery/public-api';
import { PaymentModule } from 'src/features/payments/public-api';
import { PromotionsModule } from 'src/features/promotions/public-api';
import { RestaurantsModule } from 'src/features/restaurants/public-api';
import { OrderReviewReaderModule } from 'src/features/reviews/review-reader.public-api';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { CHAT_ORDERING } from './contracts/chat-ordering.port';
import { ORDER_ANALYTICS_READER } from './contracts/order-analytics-reader.port';
import { ORDER_MESSAGING_READER } from './contracts/order-messaging-reader.port';
import { ORDER_NOTIFICATION_READER } from './contracts/order-notification-reader.port';
import { ORDER_REVIEW_ELIGIBILITY_READER } from './contracts/order-review-eligibility-reader.port';
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
  OrderReviewEligibilityService,
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
    EventsModule,
    JwtModule,
    PaymentModule,
    PromotionsModule,
    IdentityModule,
    RestaurantsModule,
    OrderReviewReaderModule,
    DeliveryModule,
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
    OrderReviewEligibilityService,
    { provide: CHAT_ORDERING, useExisting: ChatOrderingService },
    { provide: ORDER_ANALYTICS_READER, useExisting: OrderAnalyticsReaderAdapter },
    { provide: ORDER_MESSAGING_READER, useExisting: OrderMessagingReaderService },
    { provide: ORDER_NOTIFICATION_READER, useExisting: OrderNotificationReaderAdapter },
    { provide: ORDER_REVIEW_ELIGIBILITY_READER, useExisting: OrderReviewEligibilityService },
  ],
  exports: [
    OrderService,
    CustomerOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderCoreService,
    ORDER_REVIEW_ELIGIBILITY_READER,
    CHAT_ORDERING,
    ORDER_ANALYTICS_READER,
    ORDER_MESSAGING_READER,
    ORDER_NOTIFICATION_READER,
  ],
})
export class OrdersModule {}
