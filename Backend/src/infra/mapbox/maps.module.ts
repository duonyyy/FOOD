import { Global, Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapboxService } from './mapbox.service';

@Global()
@Module({
  providers: [GeocodingService, MapboxService],
  exports: [GeocodingService, MapboxService],
})
export class MapsModule {}
