import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { AppCacheModule } from 'src/infra/cache/public-api';
import { QueueModule } from 'src/infra/queue/public-api';
import { DeliveryEarningsEvent } from '../../entities/deliveryEarningsEvent.entity';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { AuthModule } from '../auth/auth-module.public-api';
import { OrdersModule } from '../orders/public-api';
import { SystemConstraintsModule } from '../system-constraints/public-api';
import { IdentityModule } from '../users/public-api';
import { RedisPendingAssignmentStore } from './adapters/redis-pending-assignment-store.service';
import { AdminDeliveryController } from './controllers/admin-delivery.controller';
import { CustomerDeliveryController } from './controllers/customer-delivery.controller';
import { LegacyShipperAdminController } from './controllers/legacy-shipper-admin.controller';
import {
  DeliveryAssignmentController,
  ShipperDeliveryController,
} from './controllers/shipper-delivery.controller';
import { ShipperResolver } from './controllers/shipper.resolver';
import { DELIVERY_ASSIGNMENT_QUEUE } from './queue/delivery-queue.constants';
import { FindShipperProcessor } from './queue/find-shipper.processor';
import { AdminDeliveryService } from './services/admin/admin-delivery.service';
import { ActiveShipperTrackerService } from './services/dispatch/active-shipper-tracker.service';
import { DeliveryDispatchService } from './services/dispatch/delivery-dispatch.service';
import { OrderStatusDeliveryHandler } from './services/dispatch/order-status-delivery.handler';
import { DeliveryIntegrationService } from './services/integration/delivery-integration.service';
import { DeliveryAssignmentSagaService } from './services/shipper/delivery-assignment-saga.service';
import { DeliveryCompletionService } from './services/shipper/delivery-completion.service';
import { DeliveryEarningsService } from './services/shipper/delivery-earnings.service';
import { DeliveryReportService } from './services/shipper/delivery-report.service';
import { ShipperDeliveryService } from './services/shipper/shipper-delivery.service';
import { DeliverySubscriptionAccessService } from './services/subscription/delivery-subscription-access.service';
import { ShipperProfileModule } from './shipper-profile.module';

/** Delivery owns delivery persistence, dispatching, earnings and shipper runtime flows. */
const queueProcessorProviders =
  process.env.QUEUE_PROCESSOR_ENABLED === 'true' ? [FindShipperProcessor] : [];

const deliveryQueueModule = QueueModule.register({
  name: DELIVERY_ASSIGNMENT_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingShipperAssignment,
      ShippingDetail,
      DeliveryEarningsEvent,
      ShipperCertificateInfo,
      ShipperProfile,
    ]),
    AppCacheModule,
    EventsModule,
    AuthModule,
    OrdersModule,
    IdentityModule,
    SystemConstraintsModule,
    deliveryQueueModule,
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
    OrderStatusDeliveryHandler,
    DeliveryEarningsService,
    DeliveryIntegrationService,
    DeliveryAssignmentSagaService,
    DeliveryCompletionService,
    DeliverySubscriptionAccessService,
    ShipperDeliveryService,
    DeliveryReportService,
    AdminDeliveryService,
    ShipperResolver,
    RedisPendingAssignmentStore,
  ],
  exports: [
    DeliveryDispatchService,
    ActiveShipperTrackerService,
    DeliveryEarningsService,
    ShipperDeliveryService,
    DeliveryReportService,
    AdminDeliveryService,
    DeliveryIntegrationService,
    ShipperProfileModule,
  ],
})
export class DeliveryModule {}
