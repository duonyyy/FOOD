import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { IdentityUserProfileModule } from '../users/identity-user-profile.public-api';
import { ShipperProfileService } from './services/shipper/shipper-profile.service';

/** Internal Delivery module shared by auth/user compatibility facades. */
@Module({
  imports: [TypeOrmModule.forFeature([ShipperProfile]), IdentityUserProfileModule],
  providers: [ShipperProfileService],
  exports: [TypeOrmModule, ShipperProfileService],
})
export class ShipperProfileModule {}
