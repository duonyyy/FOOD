import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEvent, OutboxEventStatus } from 'src/entities/outbox-event.entity';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { InProcessEventBus } from './in-process-event-bus.service';

export interface EnqueueOutboxEventRequest {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly eventBus: InProcessEventBus,
  ) {}

  async enqueue(manager: EntityManager, request: EnqueueOutboxEventRequest): Promise<OutboxEvent> {
    const repository = manager.getRepository(OutboxEvent);
    const existing = await repository.findOne({
      where: { idempotencyKey: request.idempotencyKey },
    });
    if (existing) return existing;

    return repository.save(
      repository.create({
        ...request,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        lastError: null,
        publishedAt: null,
      }),
    );
  }

  async dispatchAfterCommit(eventId: string): Promise<OutboxEvent> {
    const event = await this.outboxRepository.findOne({ where: { id: eventId } });
    if (!event) throw new Error(`Outbox event ${eventId} not found`);
    if (event.status === OutboxEventStatus.PUBLISHED) return event;

    try {
      await this.eventBus.publish(event.eventType, event.payload);
      event.status = OutboxEventStatus.PUBLISHED;
      event.attempts += 1;
      event.publishedAt = new Date();
      event.lastError = null;
    } catch (error) {
      event.status = OutboxEventStatus.FAILED;
      event.attempts += 1;
      event.availableAt = new Date(Date.now() + Math.min(60_000, 2 ** event.attempts * 1000));
      event.lastError = error instanceof Error ? error.message : String(error);
      await this.outboxRepository.save(event);
      this.logger.error(`Outbox dispatch failed for ${event.id}: ${event.lastError}`);
      throw error;
    }

    return this.outboxRepository.save(event);
  }

  async dispatchPending(limit = 50): Promise<number> {
    const events = await this.outboxRepository.find({
      where: [
        { status: OutboxEventStatus.PENDING, availableAt: LessThanOrEqual(new Date()) },
        { status: OutboxEventStatus.FAILED, availableAt: LessThanOrEqual(new Date()) },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
    });

    let dispatched = 0;
    for (const event of events) {
      try {
        await this.dispatchAfterCommit(event.id);
        dispatched += 1;
      } catch {
        // Keep failed event for the next retry cycle.
      }
    }
    return dispatched;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async retryPendingEvents(): Promise<void> {
    await this.dispatchPending();
  }
}
