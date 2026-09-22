import { OutboxService } from 'src/common/events/outbox.service';
import { OutboxEventStatus } from 'src/entities/outbox-event.entity';

describe('OutboxService', () => {
  const createService = () => {
    const event = {
      id: 'event-1',
      eventType: 'ordering.order.created',
      aggregateType: 'Order',
      aggregateId: 'order-1',
      idempotencyKey: 'Order:order-1:created',
      payload: { orderId: 'order-1' },
      status: OutboxEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(0),
      lastError: null,
      publishedAt: null,
    };
    const outboxRepository = {
      findOne: jest.fn().mockResolvedValue(event),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: typeof event) => Promise.resolve(value)),
    };
    const eventBus = { publishRequired: jest.fn().mockResolvedValue(undefined) };
    const service = new OutboxService(outboxRepository as never, eventBus as never);
    return { service, event, outboxRepository, eventBus };
  };

  it('dispatches once and is idempotent after publish', async () => {
    const { service, event, eventBus, outboxRepository } = createService();

    await service.dispatchAfterCommit(event.id);
    await service.dispatchAfterCommit(event.id);

    expect(eventBus.publishRequired).toHaveBeenCalledTimes(1);
    expect(event.status).toBe(OutboxEventStatus.PUBLISHED);
    expect(outboxRepository.save).toHaveBeenCalled();
  });

  it('marks failed dispatch for retry and preserves the error', async () => {
    const { service, event, eventBus, outboxRepository } = createService();
    eventBus.publishRequired.mockRejectedValueOnce(new Error('temporary bus failure'));

    await expect(service.dispatchAfterCommit(event.id)).rejects.toThrow('temporary bus failure');

    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.attempts).toBe(1);
    expect(event.lastError).toBe('temporary bus failure');
    expect(outboxRepository.save).toHaveBeenCalledWith(event);
  });

  it('does not publish an event when no subscriber is registered', async () => {
    const { service, event, eventBus } = createService();
    eventBus.publishRequired.mockRejectedValueOnce(
      new Error('No subscriber registered for outbox event ordering.order.created'),
    );

    await expect(service.dispatchAfterCommit(event.id)).rejects.toThrow('No subscriber registered');

    expect(event.status).toBe(OutboxEventStatus.FAILED);
  });

  it('leaves events pending in the queue worker process', async () => {
    const previous = process.env.QUEUE_PROCESSOR_ENABLED;
    process.env.QUEUE_PROCESSOR_ENABLED = 'true';
    const { service, event, eventBus, outboxRepository } = createService();

    try {
      await expect(service.dispatchAfterCommit(event.id)).resolves.toBe(event);
      expect(eventBus.publishRequired).not.toHaveBeenCalled();
      expect(outboxRepository.save).not.toHaveBeenCalled();
      expect(event.status).toBe(OutboxEventStatus.PENDING);
    } finally {
      if (previous === undefined) delete process.env.QUEUE_PROCESSOR_ENABLED;
      else process.env.QUEUE_PROCESSOR_ENABLED = previous;
    }
  });
});
