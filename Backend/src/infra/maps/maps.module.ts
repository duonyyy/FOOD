import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapboxService } from './mapbox.service';

@Module({
  providers: [GeocodingService, MapboxService],
  exports: [GeocodingService, MapboxService],
})
export class MapsModule {}
