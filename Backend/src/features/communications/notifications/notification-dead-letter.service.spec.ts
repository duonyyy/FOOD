import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationDeadLetter } from 'src/entities/notification-dead-letter.entity';
import { NotificationDeadLetterService } from './notification-dead-letter.service';

describe('NotificationDeadLetterService', () => {
  it('records the first exhausted event and increments attempts on replay', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        idempotencyKey: 'payment.succeeded:checkout-1:user-1',
        attempts: 1,
        lastError: 'first failure',
        payload: {},
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        NotificationDeadLetterService,
        { provide: getRepositoryToken(NotificationDeadLetter), useValue: repository },
      ],
    }).compile();
    const service = module.get(NotificationDeadLetterService);
    const request = {
      idempotencyKey: 'payment.succeeded:checkout-1:user-1',
      eventType: 'payment.succeeded',
      recipientUserId: 'user-1',
      payload: { orderId: 'order-1' },
      error: 'database unavailable',
    };

    await service.record(request);
    await service.record(request);

    expect(repository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        idempotencyKey: request.idempotencyKey,
        eventType: request.eventType,
        recipientUserId: request.recipientUserId,
        payload: request.payload,
        lastError: request.error,
      }),
    );
    expect(repository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attempts: 2, lastError: 'database unavailable' }),
    );
  });
});
