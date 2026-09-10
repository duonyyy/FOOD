import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import minioConfig from './config/minio.config';
import { FindShipperProcessor } from './features/delivery/queue/find-shipper.processor';
import { DatabaseModule } from './infra/database/database.module';
import { QueueModule } from './infra/queue/queue.module';
import { ShipperModule } from './modules/shipper/shipper.module';

/**
 * The worker deliberately imports only the dependencies needed by delivery
 * assignment. HTTP controllers, payment gateways and notification providers
 * stay in the API process.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [minioConfig],
    }),
    DatabaseModule,
    QueueModule,
    ScheduleModule.forRoot(),
    ShipperModule,
  ],
  providers: [FindShipperProcessor],
})
export class WorkerModule {}
