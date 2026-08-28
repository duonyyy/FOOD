import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { DeliveryEarningsEvent } from '../../entities/deliveryEarningsEvent.entity';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { ShipperModule } from '../../modules/shipper/shipper.module';
import { SHIPPER_PROFILE_READER } from './contracts/shipper-profile.port';
import { DeliveryAssignmentController } from './delivery-assignment.controller';
import { FindShipperProcessor } from './queue/find-shipper.processor';
import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';
import { DeliveryCompletedProjectionHandler } from './services/delivery-completed-projection.handler';
import { DeliveryEarningsProjectionService } from './services/delivery-earnings-projection.service';
import { ShipperProfileService } from './services/shipper-profile.service';

/** Delivery owns delivery persistence; ShipperModule remains a compatibility adapter. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingShipperAssignment,
      ShippingDetail,
      ShipperProfile,
      DeliveryEarningsEvent,
      ShipperCertificateInfo,
    ]),
    AuthModule,
    ShipperModule,
  ],
  controllers: [DeliveryAssignmentController],
  providers: [
    FindShipperProcessor,
    DeliveryAssignmentCommandService,
    ShipperProfileService,
    DeliveryEarningsProjectionService,
    DeliveryCompletedProjectionHandler,
    { provide: SHIPPER_PROFILE_READER, useExisting: ShipperProfileService },
  ],
  exports: [
    SHIPPER_PROFILE_READER,
    ShipperProfileService,
    DeliveryEarningsProjectionService,
    ShipperModule,
  ],
})
export class DeliveryModule {}
