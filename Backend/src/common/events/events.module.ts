import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from 'src/entities/outbox-event.entity';
import { InProcessEventBus } from './in-process-event-bus.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [InProcessEventBus, OutboxService],
  exports: [InProcessEventBus, OutboxService],
})
export class EventsModule {}
