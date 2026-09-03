import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/public-api';
import { CommunicationsModule } from './communications/public-api';
import { DashboardModule } from './dashboard/public-api';
import { DeliveryModule } from './delivery/public-api';
import { IdentityModule } from './identity/public-api';
import { LocationsModule } from './locations/public-api';
import { MenuModule } from './menu/public-api';
import { OrdersModule } from './orders/public-api';
import { PaymentsModule } from './payments/public-api';
import { PromotionsModule } from './promotions/public-api';
import { RestaurantsModule } from './restaurants/public-api';
import { ReviewsModule } from './reviews/public-api';
import { SystemConstraintsModule } from './system-constraints/public-api';

@Module({
  imports: [
    AnalyticsModule,
    IdentityModule,
    LocationsModule,
    RestaurantsModule,
    MenuModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    ReviewsModule,
    CommunicationsModule,
    DashboardModule,
    SystemConstraintsModule,
  ],
})
export class FeaturesModule {}
