import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Category } from 'src/entities/category.entity';
import { Checkout } from 'src/entities/checkout.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { StorageModule } from 'src/infra/storage/storage.module';
import { PendingAssignmentService } from './pending-assignment.service';
import { PendingAssignmentStore } from './pending-assignment-store.service';
import { FindShipperProcessor } from './processors/find-shipper.processor';
import { QueueNames } from './queue.constants';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: QueueNames.FIND_SHIPPER,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    }),
    StorageModule,
    TypeOrmModule.forFeature([
      User,
      ShippingDetail,
      Order,
      Address,
      Promotion,
      Food,
      Restaurant,
      Category,
      OrderDetail,
      Role,
      Review,
      Checkout,
    ]),
  ],
  providers: [
    QueueService,
    PendingAssignmentStore,
    PendingAssignmentService,
    FindShipperProcessor,
  ],
  exports: [QueueService, PendingAssignmentService],
})
export class QueueModule {}
