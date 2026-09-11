import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/public-api';
import { CommunicationsModule } from './communications/public-api';
import { DeliveryModule } from './delivery/public-api';
import { LocationsModule } from './locations/public-api';
import { MenuModule } from './menu/public-api';
import { NotificationsModule } from './notifications/public-api';
import { OrdersModule } from './orders/public-api';
import { PaymentModule } from './payments/public-api';
import { PromotionsModule } from './promotions/public-api';
import { RestaurantsModule } from './restaurants/public-api';
import { ReviewsModule } from './reviews/public-api';
import { SystemConstraintsModule } from './system-constraints/public-api';
import { IdentityModule } from './users/public-api';

@Module({
  imports: [
    AnalyticsModule,
    IdentityModule,
    LocationsModule,
    RestaurantsModule,
    MenuModule,
    PromotionsModule,
    OrdersModule,
    PaymentModule,
    DeliveryModule,
    ReviewsModule,
    CommunicationsModule,
    NotificationsModule,
    SystemConstraintsModule,
  ],
})
export class FeaturesModule {}
