import { Module } from '@nestjs/common';
import { GEOCODING_PORT } from '../contracts/geocoding.port';
import { GeocodingPortAdapter } from './geocoding-port.adapter';
import { MapsModule } from './maps.module';

@Module({
  imports: [MapsModule],
  providers: [GeocodingPortAdapter, { provide: GEOCODING_PORT, useExisting: GeocodingPortAdapter }],
  exports: [GEOCODING_PORT],
})
export class GeocodingAdapterModule {}
