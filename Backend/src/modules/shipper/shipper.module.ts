import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { DELIVERY_ASSIGNMENT_QUEUE_PORT } from 'src/features/delivery/contracts/delivery-assignment-queue.port';
import { DELIVERY_ORDER_READER } from 'src/features/delivery/contracts/delivery-order-reader.port';
import { PENDING_ASSIGNMENT_STORE } from 'src/features/delivery/contracts/pending-assignment-store.port';
import { DeliveryAssignmentScheduler } from 'src/features/delivery/services/delivery-assignment-scheduler.service';
import { PendingAssignmentStore } from 'src/infra/queue/pending-assignment-store.service';
import { QueueModule } from 'src/infra/queue/queue.module';
import { QueueService } from 'src/infra/queue/queue.service';
import { UsersModule } from '../users/users.module';
import { DeliveryOrderReaderAdapter } from './delivery-order-reader.adapter';
import { ShipperController } from './shipper.controller';
import { ShipperResolver } from './shipper.resolver';
import { ShipperService } from './shipper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, ShippingDetail, ShipperCertificateInfo]),
    UsersModule,
    JwtModule,
    QueueModule,
  ],
  controllers: [ShipperController],
  providers: [
    ShipperService,
    ShipperResolver,
    DeliveryAssignmentScheduler,
    DeliveryOrderReaderAdapter,
    { provide: DELIVERY_ORDER_READER, useExisting: DeliveryOrderReaderAdapter },
    { provide: DELIVERY_ASSIGNMENT_QUEUE_PORT, useExisting: QueueService },
    { provide: PENDING_ASSIGNMENT_STORE, useExisting: PendingAssignmentStore },
  ],
  exports: [
    ShipperService,
    DeliveryAssignmentScheduler,
    DELIVERY_ORDER_READER,
    DELIVERY_ASSIGNMENT_QUEUE_PORT,
    PENDING_ASSIGNMENT_STORE,
  ],
})
export class ShipperModule {}
