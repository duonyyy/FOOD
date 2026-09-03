import { Module } from '@nestjs/common';
import { OrderModule } from '../../modules/order/order.module';
import { OrderAnalyticsReaderAdapter } from './analytics-reader/order-analytics-reader.adapter';
import { ChatOrderingService } from './chat-ordering/chat-ordering.service';
import { CHAT_ORDERING } from './contracts/chat-ordering.port';
import { ORDER_ANALYTICS_READER } from './contracts/order-analytics-reader.port';
import { ORDER_NOTIFICATION_READER } from './contracts/order-notification-reader.port';
import { OrderNotificationReaderAdapter } from './notification-reader/order-notification-reader.adapter';
import { OrderReviewEligibilityModule } from './review-eligibility/order-review-eligibility.module';

/** Compatibility shell for the order aggregate. */
@Module({
  imports: [OrderModule, OrderReviewEligibilityModule],
  providers: [
    ChatOrderingService,
    OrderAnalyticsReaderAdapter,
    OrderNotificationReaderAdapter,
    { provide: CHAT_ORDERING, useExisting: ChatOrderingService },
    { provide: ORDER_ANALYTICS_READER, useExisting: OrderAnalyticsReaderAdapter },
    { provide: ORDER_NOTIFICATION_READER, useExisting: OrderNotificationReaderAdapter },
  ],
  exports: [
    OrderReviewEligibilityModule,
    CHAT_ORDERING,
    ORDER_ANALYTICS_READER,
    ORDER_NOTIFICATION_READER,
  ],
})
export class OrdersModule {}
