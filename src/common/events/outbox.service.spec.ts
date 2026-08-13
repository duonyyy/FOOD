import { OutboxEventStatus } from 'src/entities/outbox-event.entity';
import { OutboxService } from './outbox.service';

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
      save: jest.fn(async (value) => value),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new OutboxService(outboxRepository as never, eventBus as never);
    return { service, event, outboxRepository, eventBus };
  };

  it('dispatches once and is idempotent after publish', async () => {
    const { service, event, eventBus, outboxRepository } = createService();

    await service.dispatchAfterCommit(event.id);
    await service.dispatchAfterCommit(event.id);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(event.status).toBe(OutboxEventStatus.PUBLISHED);
    expect(outboxRepository.save).toHaveBeenCalled();
  });

  it('marks failed dispatch for retry and preserves the error', async () => {
    const { service, event, eventBus, outboxRepository } = createService();
    eventBus.publish.mockRejectedValueOnce(new Error('temporary bus failure'));

    await expect(service.dispatchAfterCommit(event.id)).rejects.toThrow('temporary bus failure');

    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.attempts).toBe(1);
    expect(event.lastError).toBe('temporary bus failure');
    expect(outboxRepository.save).toHaveBeenCalledWith(event);
  });
});
