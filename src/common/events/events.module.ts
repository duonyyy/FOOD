import { Global, Module } from '@nestjs/common';
import { InProcessEventBus } from './in-process-event-bus.service';

@Global()
@Module({
  providers: [InProcessEventBus],
  exports: [InProcessEventBus],
})
export class EventsModule {}
