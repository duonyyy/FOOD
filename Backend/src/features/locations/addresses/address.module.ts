import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { GeocodingAdapterModule } from 'src/infra/mapbox/public-api';
import { IdentityModule } from '../../users/public-api';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

@Module({
  imports: [TypeOrmModule.forFeature([Address]), IdentityModule, GeocodingAdapterModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService, GeocodingAdapterModule],
})
export class AddressModule {}
