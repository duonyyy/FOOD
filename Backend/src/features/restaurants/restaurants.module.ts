import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { EventsModule } from '../../common/events/events.module';
import { Restaurant } from '../../entities/restaurant.entity';
import { RestaurantApprovalAudit } from '../../entities/restaurantApprovalAudit.entity';
import { LocationsModule } from '../locations/public-api';
import { IdentityModule } from '../users/public-api';

import { AdminRestaurantsController } from './controllers/admin-restaurants.controller';
import { MerchantRestaurantsController } from './controllers/merchant-restaurants.controller';
import { AdminRestaurantsService } from './services/admin-restaurants.service';
import { CustomerRestaurantsService } from './services/customer-restaurants.service';
import { MerchantRestaurantsService } from './services/merchant-restaurants.service';
import { PublicRestaurantsService } from './services/public-restaurants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, RestaurantApprovalAudit]),
    EventsModule,
    LocationsModule,
    IdentityModule,
    AuthModule,
  ],
  controllers: [AdminRestaurantsController, MerchantRestaurantsController],
  providers: [
    PublicRestaurantsService,
    CustomerRestaurantsService,
    MerchantRestaurantsService,
    AdminRestaurantsService,
  ],
  exports: [PublicRestaurantsService, CustomerRestaurantsService, MerchantRestaurantsService],
})
export class RestaurantsModule {}
