import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { SHIPPER_PROFILE_COMMANDS, SHIPPER_PROFILE_READER } from './contracts/shipper-profile.port';
import { ShipperProfileService } from './services/shipper/shipper-profile.service';

/** Internal Delivery module shared by auth/user compatibility facades. */
@Module({
  imports: [TypeOrmModule.forFeature([ShipperProfile])],
  providers: [
    ShipperProfileService,
    { provide: SHIPPER_PROFILE_READER, useExisting: ShipperProfileService },
    { provide: SHIPPER_PROFILE_COMMANDS, useExisting: ShipperProfileService },
  ],
  exports: [TypeOrmModule, ShipperProfileService, SHIPPER_PROFILE_READER, SHIPPER_PROFILE_COMMANDS],
})
export class ShipperProfileModule {}
