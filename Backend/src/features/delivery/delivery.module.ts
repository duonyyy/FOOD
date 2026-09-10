import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { DeliveryEarningsEvent } from '../../entities/deliveryEarningsEvent.entity';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { ShipperModule } from '../../modules/shipper/shipper.module';
import { DeliveryAssignmentController } from './delivery-assignment.controller';
import { FindShipperProcessor } from './queue/find-shipper.processor';
import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';
import { DeliveryCompletedProjectionHandler } from './services/delivery-completed-projection.handler';
import { DeliveryEarningsProjectionService } from './services/delivery-earnings-projection.service';
import { ShipperProfileModule } from './shipper-profile.module';

/** Delivery owns delivery persistence; ShipperModule remains a compatibility adapter. */
const queueProcessorProviders =
  process.env.QUEUE_PROCESSOR_ENABLED === 'true' ? [FindShipperProcessor] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingShipperAssignment,
      ShippingDetail,
      DeliveryEarningsEvent,
      ShipperCertificateInfo,
    ]),
    AuthModule,
    ShipperModule,
    ShipperProfileModule,
  ],
  controllers: [DeliveryAssignmentController],
  providers: [
    ...queueProcessorProviders,
    DeliveryAssignmentCommandService,
    DeliveryEarningsProjectionService,
    DeliveryCompletedProjectionHandler,
  ],
  exports: [DeliveryEarningsProjectionService, ShipperModule, ShipperProfileModule],
})
export class DeliveryModule {}
