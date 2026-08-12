import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../common/events/events.module';
import { Restaurant } from '../../entities/restaurant.entity';
import { RestaurantApprovalAudit } from '../../entities/restaurantApprovalAudit.entity';
import { IdentityModule } from '../identity/public-api';
import { LocationsModule } from '../locations/public-api';
import { MenuModule } from '../menu/public-api';

import { RESTAURANT_READER } from './contracts/restaurant-reader.port';
import { RestaurantAdminController } from './controllers/admin-restaurants.controller';
import { RestaurantMerchantController } from './controllers/merchant-profile.controller';
import { RestaurantDiscoveryController } from './controllers/public-discovery.controller';
import { RestaurantApprovalService } from './services/restaurant-approval.service';
import { RestaurantDiscoveryService } from './services/restaurant-discovery.service';
import { RestaurantProfileService } from './services/restaurant-profile.service';
import { RestaurantReaderService } from './services/restaurant-reader.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, RestaurantApprovalAudit]),
    EventsModule,
    LocationsModule,
    IdentityModule,
    MenuModule,
  ],
  controllers: [
    RestaurantAdminController,
    RestaurantMerchantController,
    RestaurantDiscoveryController,
  ],
  providers: [
    RestaurantDiscoveryService,
    RestaurantProfileService,
    RestaurantApprovalService,
    RestaurantReaderService,
    { provide: RESTAURANT_READER, useExisting: RestaurantReaderService },
  ],
  exports: [
    RestaurantDiscoveryService,
    RestaurantProfileService,
    RestaurantApprovalService,
    RESTAURANT_READER,
  ],
})
export class RestaurantsModule {}
