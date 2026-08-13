import { Injectable } from '@nestjs/common';
import type { RoutePort } from '../contracts/route.port';
import { MapboxService } from './mapbox.service';

@Injectable()
export class RoutePortAdapter implements RoutePort {
  constructor(private readonly mapboxService: MapboxService) {}

  getDistanceAndDuration(
    origin: [number, number],
    destination: [number, number],
  ): Promise<{ distanceKm: number; durationMin: number } | null> {
    return this.mapboxService.getDistanceAndDurationFromMapbox(origin, destination);
  }
}
