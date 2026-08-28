import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from 'src/infra/storage/storage.module';
import { PendingAssignmentStore } from './pending-assignment-store.service';
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
  ],
  providers: [QueueService, PendingAssignmentStore],
  exports: [QueueService, PendingAssignmentStore],
})
export class QueueModule {}
