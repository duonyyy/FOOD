import { Module } from '@nestjs/common';
import { AddressModule } from '../../modules/address/address.module';

/** Compatibility shell for address and geocoding ownership. */
@Module({ imports: [AddressModule] })
export class LocationsModule {}
