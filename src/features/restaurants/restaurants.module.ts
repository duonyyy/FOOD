import { Module } from '@nestjs/common';
import { RestaurantModule } from '../../modules/restaurant/restaurant.module';

/** Compatibility shell for restaurant ownership. */
@Module({ imports: [RestaurantModule] })
export class RestaurantsModule {}
