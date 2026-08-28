import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { ShipperModule } from '../../modules/shipper/shipper.module';
import { SHIPPER_PROFILE_READER } from './contracts/shipper-profile.port';
import { DeliveryAssignmentController } from './delivery-assignment.controller';
import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';
import { ShipperProfileService } from './services/shipper-profile.service';

/** Delivery owns delivery persistence; ShipperModule remains a compatibility adapter. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingShipperAssignment,
      ShippingDetail,
      ShipperProfile,
      ShipperCertificateInfo,
    ]),
    AuthModule,
    ShipperModule,
  ],
  controllers: [DeliveryAssignmentController],
  providers: [
    DeliveryAssignmentCommandService,
    ShipperProfileService,
    { provide: SHIPPER_PROFILE_READER, useExisting: ShipperProfileService },
  ],
  exports: [SHIPPER_PROFILE_READER, ShipperProfileService],
})
export class DeliveryModule {}
