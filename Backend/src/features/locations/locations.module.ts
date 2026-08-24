import { Module } from '@nestjs/common';
import { AddressModule } from './addresses/address.module';

@Module({ imports: [AddressModule], exports: [AddressModule] })
export class LocationsModule {}
