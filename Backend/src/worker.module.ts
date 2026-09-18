import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import minioConfig from './config/minio.config';
import { DeliveryModule, FindShipperProcessor } from './features/delivery/public-api';
import { DatabaseModule } from './infra/database/database.module';

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
    ScheduleModule.forRoot(),
    DeliveryModule,
  ],
  providers: [FindShipperProcessor],
})
export class WorkerModule {}
