import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DELIVERY_COMPLETED_EVENT,
  DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';

import { DeliveryEarningsProjectionService } from './delivery-earnings-projection.service';

@Injectable()
export class DeliveryCompletedProjectionHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly projectionService: DeliveryEarningsProjectionService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<DeliveryCompletedEvent>(
      DELIVERY_COMPLETED_EVENT,
      async (event) => {
        await this.projectionService.project(event);
      },
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
