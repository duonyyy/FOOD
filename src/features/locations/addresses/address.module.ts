import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { GeocodingAdapterModule } from 'src/infra/contracts/geocoding-adapter.module';
import { IdentityModule } from '../../identity/public-api';
import { LOCATION_READER } from '../contracts/location-reader.port';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

@Module({
  imports: [TypeOrmModule.forFeature([Address]), IdentityModule, GeocodingAdapterModule],
  controllers: [AddressController],
  providers: [AddressService, { provide: LOCATION_READER, useExisting: AddressService }],
  exports: [AddressService, LOCATION_READER, GeocodingAdapterModule],
})
export class AddressModule {}
