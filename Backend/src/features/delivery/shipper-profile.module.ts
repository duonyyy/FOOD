import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShipperProfileService } from './services/shipper/shipper-profile.service';

/** Internal Delivery module shared by auth/user compatibility facades. */
@Module({
  imports: [TypeOrmModule.forFeature([ShipperProfile])],
  providers: [ShipperProfileService],
  exports: [TypeOrmModule, ShipperProfileService],
})
export class ShipperProfileModule {}
