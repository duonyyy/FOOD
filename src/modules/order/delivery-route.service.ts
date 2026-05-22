import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MapboxService } from 'src/services/mapbox.service';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { DeliveryRouteResult } from './dto/order-calculation.types';

@Injectable()
export class DeliveryRouteService {
  private readonly logger = new Logger(DeliveryRouteService.name);

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly systemConstraintsService: SystemConstraintsService,
  ) {}

  async calculateBikeRoute(
    restaurantLat: number,
    restaurantLng: number,
    userLat: number,
    userLng: number,
  ): Promise<DeliveryRouteResult> {
    const routeResult = await this.mapboxService.calculateBikeRoute(
      restaurantLat,
      restaurantLng,
      userLat,
      userLng,
    );

    const distance = routeResult.distance;
    const estimatedDeliveryTime = Math.round(routeResult.duration / 60);

    this.logger.log(
      `Mapbox route calculated: ${distance}km, ${estimatedDeliveryTime} minutes`,
    );

    return { distance, estimatedDeliveryTime };
  }

  async ensureDistanceWithinLimits(
    distance: number,
    maxDistance: number,
  ): Promise<void> {
    if (
      !(await this.systemConstraintsService.isDistanceWithinLimits(distance))
    ) {
      this.logger.error(
        `Distance validation failed: ${distance}km > ${maxDistance}km`,
      );
      throw new BadRequestException(
        `Delivery distance of ${distance}km exceeds the maximum of ${maxDistance}km.`,
      );
    }
  }
}
