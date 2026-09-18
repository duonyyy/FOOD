import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_INSTANCE, REGISTERED_QUEUE_NAME } from './queue.constants';
import { QueueService } from './queue.service';
import type { QueueRegistrationOptions } from './queue.types';

@Module({})
export class QueueModule {
  static register(options: QueueRegistrationOptions): DynamicModule {
    return {
      module: QueueModule,
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
          name: options.name,
          defaultJobOptions: options.defaultJobOptions,
        }),
      ],
      providers: [
        { provide: REGISTERED_QUEUE_NAME, useValue: options.name },
        {
          provide: QUEUE_INSTANCE,
          inject: [getQueueToken(options.name)],
          useFactory: (queue: unknown) => queue,
        },
        QueueService,
      ],
      exports: [QueueService],
    };
  }
}
