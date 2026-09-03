import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from 'src/entities/notification.entity';
import { NotificationService } from './notification.service';

function mockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-uuid-1',
    description: 'Test notification',
    content: 'Test content',
    receiveUser: 'user-1',
    type: 'order',
    isRead: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as Notification;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: {
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('create', () => {
    it('saves a notification and returns it', async () => {
      const saved = mockNotification();
      repo.save.mockResolvedValue(saved);

      const result = await service.create({
        recipientUserId: 'user-1',
        description: 'Desc',
        content: 'Content',
        type: 'order',
      });

      expect(repo.save).toHaveBeenCalledWith({
        receiveUser: 'user-1',
        description: 'Desc',
        content: 'Content',
        type: 'order',
        isRead: false,
        idempotencyKey: null,
      });
      expect(result).toBe(saved);
    });

    it('returns an existing notification for a replayed event key', async () => {
      const existing = mockNotification({ idempotencyKey: 'payment.succeeded:checkout-1:user-1' });
      repo.findOne.mockResolvedValue(existing);

      const result = await service.createFromEvent({
        recipientUserId: 'user-1',
        description: 'Thanh toán thành công',
        content: 'Đã thanh toán',
        type: 'payment',
        idempotencyKey: 'payment.succeeded:checkout-1:user-1',
      });

      expect(result).toEqual({ notification: existing, created: false });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('treats a unique-key race as an event replay', async () => {
      const existing = mockNotification({ idempotencyKey: 'delivery.completed:order-1:user-1' });
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      repo.save.mockRejectedValue({ code: '23505' });

      const result = await service.createFromEvent({
        recipientUserId: 'user-1',
        description: 'Đơn hàng đã hoàn thành',
        content: 'Đã giao hàng',
        type: 'delivery',
        idempotencyKey: 'delivery.completed:order-1:user-1',
      });

      expect(result).toEqual({ notification: existing, created: false });
    });
  });

  describe('findByUser', () => {
    it('returns paginated results with total count', async () => {
      const entities = [mockNotification()];
      repo.findAndCount.mockResolvedValue([entities, 1]);

      const result = await service.findByUser('user-1', 1, 20);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { receiveUser: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('notif-uuid-1');
    });

    it('computes skip for page > 1', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-1', 3, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read when the actor is the recipient', async () => {
      const notif = mockNotification({ isRead: false });
      repo.findOne.mockResolvedValue(notif);
      repo.save.mockImplementation((n) => Promise.resolve(n));

      const result = await service.markAsRead('notif-uuid-1', 'user-1');

      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when actor is not the recipient', async () => {
      const notif = mockNotification({ receiveUser: 'other-user' });
      repo.findOne.mockResolvedValue(notif);

      await expect(service.markAsRead('notif-uuid-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
