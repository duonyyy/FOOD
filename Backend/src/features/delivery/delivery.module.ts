import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryEarningsEvent } from '../../entities/deliveryEarningsEvent.entity';
import { Order } from '../../entities/order.entity';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { User } from '../../entities/user.entity';
import { PendingAssignmentStore } from '../../infra/queue/pending-assignment-store.service';
import { QueueModule } from '../../infra/queue/queue.module';
import { QueueService } from '../../infra/queue/queue.service';
import { AuthModule } from '../auth/auth.module';
import { OrderTrackingReaderModule } from '../orders/order-tracking-reader.public-api';
import { SystemConstraintsModule } from '../system-constraints/public-api';
import { IdentityModule } from '../users/public-api';
import { DELIVERY_ASSIGNMENT_QUEUE_PORT } from './contracts/delivery-assignment-queue.port';
import { DELIVERY_ORDER_READER } from './contracts/delivery-order-reader.port';
import { DELIVERY_QUOTE_PORT } from './contracts/delivery-quote.port';
import { PENDING_ASSIGNMENT_STORE } from './contracts/pending-assignment-store.port';
import { AdminDeliveryController } from './controllers/admin-delivery.controller';
import { CustomerDeliveryController } from './controllers/customer-delivery.controller';
import { LegacyShipperAdminController } from './controllers/legacy-shipper-admin.controller';
import {
  DeliveryAssignmentController,
  ShipperDeliveryController,
} from './controllers/shipper-delivery.controller';
import { ShipperResolver } from './controllers/shipper.resolver';
import { FindShipperProcessor } from './queue/find-shipper.processor';
import { AdminDeliveryService } from './services/admin/admin-delivery.service';
import { ActiveShipperTrackerService } from './services/dispatch/active-shipper-tracker.service';
import { DeliveryAssignmentCommandService } from './services/dispatch/delivery-assignment-command.service';
import {
  DeliveryAssignmentScheduler,
  DeliveryDispatchService,
} from './services/dispatch/delivery-dispatch.service';
import { DeliveryIntegrationService } from './services/integration/delivery-integration.service';
import {
  DeliveryEarningsProjectionService,
  DeliveryEarningsService,
} from './services/shipper/delivery-earnings.service';
import { DeliveryReportService } from './services/shipper/delivery-report.service';
import { ShipperDeliveryService } from './services/shipper/shipper-delivery.service';
import { ShipperService } from './services/shipper/shipper.service';
import { ShipperProfileModule } from './shipper-profile.module';

/** Delivery owns delivery persistence, dispatching, earnings and shipper runtime flows. */
const queueProcessorProviders =
  process.env.QUEUE_PROCESSOR_ENABLED === 'true' ? [FindShipperProcessor] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingShipperAssignment,
      ShippingDetail,
      DeliveryEarningsEvent,
      ShipperCertificateInfo,
      User,
      Order,
    ]),
    AuthModule,
    OrderTrackingReaderModule,
    IdentityModule,
    SystemConstraintsModule,
    QueueModule,
    ShipperProfileModule,
  ],
  controllers: [
    ShipperDeliveryController,
    DeliveryAssignmentController,
    AdminDeliveryController,
    CustomerDeliveryController,
    LegacyShipperAdminController,
  ],
  providers: [
    ...queueProcessorProviders,
    ActiveShipperTrackerService,
    DeliveryDispatchService,
    { provide: DeliveryAssignmentScheduler, useExisting: DeliveryDispatchService },
    { provide: DeliveryAssignmentCommandService, useExisting: DeliveryDispatchService },
    DeliveryEarningsService,
    { provide: DeliveryEarningsProjectionService, useExisting: DeliveryEarningsService },
    DeliveryIntegrationService,
    ShipperDeliveryService,
    DeliveryReportService,
    AdminDeliveryService,
    ShipperService,
    ShipperResolver,
    { provide: DELIVERY_ORDER_READER, useExisting: DeliveryIntegrationService },
    { provide: DELIVERY_QUOTE_PORT, useExisting: DeliveryIntegrationService },
    { provide: DELIVERY_ASSIGNMENT_QUEUE_PORT, useExisting: QueueService },
    { provide: PENDING_ASSIGNMENT_STORE, useExisting: PendingAssignmentStore },
  ],
  exports: [
    DeliveryDispatchService,
    ActiveShipperTrackerService,
    DeliveryAssignmentScheduler,
    DeliveryAssignmentCommandService,
    DeliveryEarningsService,
    DeliveryEarningsProjectionService,
    ShipperDeliveryService,
    DeliveryReportService,
    AdminDeliveryService,
    DeliveryIntegrationService,
    ShipperService,
    DELIVERY_ORDER_READER,
    DELIVERY_QUOTE_PORT,
    DELIVERY_ASSIGNMENT_QUEUE_PORT,
    PENDING_ASSIGNMENT_STORE,
    ShipperProfileModule,
  ],
})
export class DeliveryModule {}
