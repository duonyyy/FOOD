import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertProductionConfiguration } from './config/production-config.guard';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  assertProductionConfiguration();

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['log', 'debug', 'error', 'verbose', 'warn'],
  });
  app.enableShutdownHooks();

  new Logger('QueueWorker').log({
    event: 'queue_worker_started',
    queueProcessorsEnabled: process.env.QUEUE_PROCESSOR_ENABLED === 'true',
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Error starting queue worker:', error);
  process.exit(1);
});
