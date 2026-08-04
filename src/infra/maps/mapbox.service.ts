import { Injectable, Logger } from '@nestjs/common';
import { getProviderErrorCode, getProviderErrorType } from 'src/infra/logging/provider-error';

const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
require('dotenv').config();

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private directionsService;

  constructor() {
    const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('MAPBOX_ACCESS_TOKEN is missing in .env');
    }

    this.directionsService = mbxDirections({ accessToken });
  }

  /**
   * Get distance and duration via Mapbox Directions API
   */
  async getDistanceAndDurationFromMapbox(
    origin: [number, number], // [lng, lat]
    destination: [number, number] // [lng, lat]
  ): Promise<{ distanceKm: number; durationMin: number } | null> {
    try {
      this.logger.debug({
        event: 'provider_operation_started',
        provider: 'mapbox',
        operation: 'get_directions',
      });
      
      const res = await this.directionsService.getDirections({
        profile: 'driving', // Use driving for motorcycle/scooter delivery
        waypoints: [
          { coordinates: origin },
          { coordinates: destination },
        ],
        geometries: 'geojson',
        alternatives: false,
        overview: 'simplified',
        steps: false
      }).send();

      if (!res.body.routes || res.body.routes.length === 0) {
        this.logger.warn({
          event: 'provider_response_empty',
          provider: 'mapbox',
          operation: 'get_directions',
        });
        return null;
      }

      const route = res.body.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;

      this.logger.debug({
        event: 'provider_operation_completed',
        provider: 'mapbox',
        operation: 'get_directions',
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Number(durationMin.toFixed(1)),
      });

      return {
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Number(durationMin.toFixed(1)),
      };
    } catch (error) {
      this.logProviderError('get_directions', error);
      return null;
    }
  }

  /**
   * Enhanced method with fallback to haversine distance
   */
  async calculateBikeRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<{ distance: number; duration: number; route: any }> {
    try {
      // Call the existing method with proper coordinate order [lng, lat]
      const result = await this.getDistanceAndDurationFromMapbox(
        [fromLng, fromLat], // origin: [lng, lat]
        [toLng, toLat]      // destination: [lng, lat]
      );

      if (result) {
        return {
          distance: result.distanceKm,
          duration: result.durationMin * 60, // Convert to seconds
          route: null
        };
      }

      // Fallback to haversine if Mapbox fails
      this.logger.warn({
        event: 'provider_fallback_used',
        provider: 'mapbox',
        operation: 'calculate_bike_route',
      });
      const fallbackDistance = this.calculateHaversineDistance(fromLat, fromLng, toLat, toLng);
      
      return {
        distance: fallbackDistance,
        duration: Math.round(fallbackDistance * 180), // Rough estimate: 180 seconds per km
        route: null
      };

    } catch (error) {
      this.logProviderError('calculate_bike_route', error);
      
      // Fallback to haversine
      const fallbackDistance = this.calculateHaversineDistance(fromLat, fromLng, toLat, toLng);
      return {
        distance: fallbackDistance,
        duration: Math.round(fallbackDistance * 180),
        route: null
      };
    }
  }

  /**
   * Fallback haversine distance calculation
   */
  private calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Calculate multiple routes in batch
   */
  async calculateMultipleRoutes(
    from: { lat: number; lng: number },
    destinations: Array<{ lat: number; lng: number; id: string }>
  ): Promise<Array<{ id: string; distance: number; duration: number }>> {
    const results: Array<{ id: string; distance: number; duration: number }> = [];

    for (const destination of destinations) {
      try {
        const route = await this.calculateBikeRoute(
          from.lat, from.lng,
          destination.lat, destination.lng
        );

        results.push({
          id: destination.id,
          distance: route.distance,
          duration: route.duration
        });
      } catch (error) {
        this.logProviderError('calculate_multiple_routes', error);
      }
    }

    return results;
  }

  private logProviderError(operation: string, error: unknown): void {
    this.logger.error({
      event: 'provider_operation_failed',
      provider: 'mapbox',
      operation,
      errorCode: getProviderErrorCode(error),
      errorType: getProviderErrorType(error),
    });
  }
}

// Keep the original function for backward compatibility
export async function getDistanceAndDurationFromMapbox(
  origin: [number, number],
  destination: [number, number]
): Promise<{ distanceKm: number; durationMin: number } | null> {
  const service = new MapboxService();
  return service.getDistanceAndDurationFromMapbox(origin, destination);
}
