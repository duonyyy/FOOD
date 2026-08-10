import { Injectable } from '@nestjs/common';
import type {
  GeocodeAddressRequest,
  GeocodingPort,
  GeocodingSnapshot,
} from '../contracts/geocoding.port';
import { GeocodingService } from './geocoding.service';

@Injectable()
export class GeocodingPortAdapter implements GeocodingPort {
  constructor(private readonly geocodingService: GeocodingService) {}

  async geocode(request: GeocodeAddressRequest): Promise<GeocodingSnapshot | null> {
    const result = await this.geocodingService.geocode(request);
    return result
      ? {
          latitude: result.lat,
          longitude: result.lng,
          formattedAddress: [request.street, request.ward, request.district, request.city]
            .filter(Boolean)
            .join(', '),
        }
      : null;
  }
}
