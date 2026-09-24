import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { IdentityUserProfileModule } from '../users/identity-user-profile.public-api';
import { UsersModule } from '../users/identity-auth-modules.public-api';
import { ShipperProfileService } from './services/shipper/shipper-profile.service';

/** Internal Delivery module shared by auth/user compatibility facades. */
@Module({
  imports: [TypeOrmModule.forFeature([ShipperProfile]), IdentityUserProfileModule, UsersModule],
  providers: [ShipperProfileService],
  exports: [ShipperProfileService],
})
export class ShipperProfileModule {}
